(ns triceratops.core
  (:use triceratops.debug
        [clojure.string :only (split join trim)]
        [clojure.walk :only (keywordize-keys)]
        [cheshire.core :only (generate-string parse-string)]
        [compojure.core :only (defroutes GET)]
        [hiccup.core :only (html)]
        [lamina.core
         :only
         (permanent-channel
          enqueue receive receive-all
          filter* siphon map* close fork)]
        [aleph.http :only (start-http-server)])
  (:require [ring.adapter.jetty :as ring]
            [compojure.route :as route]
            [compojure.handler :as handler]))

(def broadcast (permanent-channel))
(def workspaces (ref {}))
(def coders (ref {}))

(defn encode
  "Takes a map defined by structure and encodes it into a string."
  [structure]
  (generate-string structure))

(defn decode
  "Takes a string and interprets it into a structured map."
  [message]
  (keywordize-keys (parse-string message true)))

(defrecord Workspace [ch name code cursors history tags])
(defrecord Coder [ch nick color cursors])
(defrecord Cursor [workspace coder pos color])

(defn mapmap
  [f m]
  (if (empty? m)
    m
    (into {} (for [[k v] m] [k (f v)]))))

(defn clean-cursors
  [cursor-haver]
  (update-in cursor-haver [:cursors] #(mapmap deref %)))
;;  (update-in cursor-haver [:cursors] #(into {} (for [[k v] %] [k (deref v)]))))

(defn clean-coder
  [coder]
  (clean-cursors
   (select-keys coder [:nick :color :cursors])))

(defn clean-workspace
  [workspace]
  (clean-cursors
   (select-keys workspace [:name :code :cursors])))

(defn coder-connect
  "Adheres the coder given by request to the channel ch."
  [ch request]
  (let [nick (keyword (request :nick))
        color (keyword (request :color))
        coder (Coder. ch nick color {})
        out-coders (mapmap clean-coder @coders)
        out-workspaces (mapmap clean-workspace @workspaces)]
    (dosync
     (alter coders merge {(keyword (:nick coder)) coder}))
    (enqueue ch (encode {:op :status :coders out-coders :workspaces out-workspaces}))
    (encode {:op :connect :coder (clean-coder coder)})))

(def respond-to)
(def workspace-commands)

(defn add-coder-to-workspace
  [workspace coder cursor]
  (dosync
   (if ((:name workspace) @workspaces)
     (alter workspaces assoc-in [(:name workspace) :cursors (:nick coder)] cursor)
     (let [joined (assoc-in workspace [:cursors (:nick coder)] cursor)]
       (alter workspaces assoc (:name workspace) joined)))
   (alter coders assoc-in [(:nick coder) :cursors (:name workspace)] cursor)))

(defn remove-coder-from-workspace
  [workspace coder]
  (dosync
   (alter workspaces update-in [(:name workspace) :cursors] #(dissoc % (:nick coder)))
   (alter coders update-in [(:nick coder) :cursors] #(dissoc % (:name workspace)))))

(defn coder-join
  "Joins the coder to the given workspace."
  [ch request]
  (let [workspace-name (keyword (request :workspace))
        nick (keyword (request :nick))
        coder (-> @coders nick)
        pos {:line 0 :ch 0}
        color (:color coder)
        cursor (ref (Cursor. workspace-name nick pos color))
        workspace
        (or (workspace-name @workspaces)
            (Workspace. (permanent-channel) workspace-name "" {nick cursor} [] {}))

        coder-ch (fork (:ch coder))
        workspace-ch (fork (:ch workspace))

        decoded (map* decode coder-ch)
        filtered (filter* #(if (workspace-commands (keyword (:op %))) %) decoded)
        process (map* (respond-to workspace-commands [coder-ch workspace-ch]) filtered)]
    (siphon process (:ch workspace))
    (siphon workspace-ch (:ch coder))
    (add-coder-to-workspace workspace coder cursor)
    (encode {:op :join
             :coder (clean-coder (nick @coders))
             :workspace (clean-workspace (workspace-name @workspaces))})))

(defn coder-say
  [coder-ch workspace-ch request]
  (encode request))

(defn coder-cursor
  [coder-ch workspace-ch request]
  (let [workspace-name (keyword (request :workspace))
        nick (keyword (request :nick))
        coder (nick @coders)
        cursor (-> @coders nick :cursors workspace-name)]
    (dosync
     (alter cursor assoc :pos (request :cursor)))
    (encode (assoc request :cursor (:pos @cursor)))))

(defn coder-change
  [coder-ch workspace-ch request]
  (encode request))

(defn coder-leave
  "Removes the given coder from the workspace"
  [coder-ch workspace-ch request]
  (let [workspace-name (keyword (request :workspace))
        nick (keyword (request :nick))
        coder (nick @coders)
        workspace (workspace-name @workspaces)
        response (encode {:op :leave :nick nick :workspace workspace-name})]
    (remove-coder-from-workspace workspace coder)
    (enqueue (:ch workspace) response)
    (close coder-ch)
    (close workspace-ch)
    response))

(defn coder-disconnect
  "Removes the given coder from the map and notifies all clients."
  [ch request]
  (let [nick (keyword (request :nick))]
    (map #() (-> @coders nick :cursors))
    (dosync
     (alter coders dissoc (keyword (request :nick))))
    (close ch)
    (encode request)))

(defn respond-to
  [commands channels]
  (fn [request]
    (debug request)
    (let [command (commands (keyword (request :op)))]
      (if command
        (apply command (conj channels request))))))

(def base-commands
  {:connect coder-connect
   :join coder-join
   :disconnect coder-disconnect})

(def workspace-commands
  {:say coder-say
   :cursor coder-cursor
   :code coder-change
   :leave coder-leave})

(defn triceratops
  "Registers the new coder with the system and establishes
  the channel it will use to broadcast to other coders."
  [ch handshake]
  (let [decoded (map* decode ch)
        filtered (filter* #(if (base-commands (keyword (:op %))) %) decoded)]
    (siphon (map* (respond-to base-commands [ch]) filtered) broadcast)
    (siphon broadcast ch)))

(defn start-websockets
  "Starts the websocket server."
  [handler port]
  (start-http-server handler {:port port :websocket true}))

(defn gateway
  [params]
  (html
   [:html
    [:head
     [:title (or (params :workspace) "TRICERATOPS")]
     [:script {:src "/js/json2.js"}]
     [:script {:src "/js/underscore.js"}]
     [:script {:src "/js/jquery.js"}]
     [:script {:src "/js/codemirror/lib/codemirror.js"}]
     [:link {:rel "stylesheet" :href "/js/codemirror/lib/codemirror.css"}]
     [:script {:src "/js/codemirror/mode/javascript/javascript.js"}]
     [:link {:rel "stylesheet" :href "/js/codemirror/theme/default.css"}]
     [:script {:src "/js/Three.js"}]
     [:script {:src "/js/amplify.store.js"}]
     [:script {:src "/js/history.adapter.jquery.js"}]
     [:script {:src "/js/history.js"}]
     [:script {:src "/js/sherpa.js"}]
     [:script {:src "/js/linkage.js"}]
     [:script {:src "/js/routing.js"}]
     [:script {:src "/js/triceratops.js"}]
     [:link {:rel "stylesheet" :href "/css/triceratops.css"}]]
    [:body 
     {:onload "triceratops.hatch()"
      :onbeforeunload "triceratops.die()"}
     [:div#identify {:style "display:none"}
      [:p "WELCOME TO TRICERATOPS"]
      [:div#nick
       [:label "what is your name?"]
       [:input {:type "text"}]]]
     [:div#triceratops]]]))

(defn home
  [params]
  (html
   [:div#home
    [:p "WELCOME TO TRICERATOPS"]
    [:div#funnel
     [:label "funnel to workspace"]
     [:input {:type "text"}]]]))

(defn workspace
  [params]
  (html
   [:div#workspace
    [:div#voice
     [:input {:type "text"}]
     [:div#out]]
    [:div#coders
     [:p "other coders"]
     [:ul]]
    [:form
     [:textarea#code {:name "code"}
      "var yellow = {wowowowow: 'hwhwhwhwhwhwhwhw'}"]]
    [:div#gl]]))

(def paths
  {:home home
   :workspace workspace})

(defn nothing
  []
  "you have reached an edge of this world where nothing exists")

(defroutes triceratops-routes
  (route/files "/" {:root "resources/public"})
  (GET "/" {params :params} (gateway params))
  (GET "/w/:workspace" {params :params} (gateway params))
  (GET "/a/:path" {params :params} ((paths (keyword (params :path))) params))
  (route/not-found (nothing)))

(def app (handler/site triceratops-routes))

(defn start-frontend
  [handler port]
  (ring/run-jetty handler {:port port :join? false}))

(defn start
  []
  (start-frontend (var app) 11133)
  (start-websockets triceratops 11122))

(defn -main []
  (start))

