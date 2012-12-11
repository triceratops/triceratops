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
  (:require [swank.swank :as swank]
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
  cursor-haver)
  ;; (update-in cursor-haver [:cursors] #(mapmap deref %)))

(defn clean-coder
  [coder]
  (clean-cursors
   (select-keys coder [:nick :color :cursors])))

(defn clean-workspace
  [workspace]
  (clean-cursors
   (select-keys workspace [:name :code :cursors])))

(defn find-coder-workspace
  [request]
  (let [space (-> request :workspace keyword)
        nick (-> request :nick keyword)
        workspace (get @workspaces space)
        coder (get @coders nick)]
    [space nick workspace coder]))

(defn coder-connect
  "Adheres the coder given by request to the channel ch."
  [ch request]
  (let [nick (-> request :nick keyword)
        color (-> request :color keyword)
        coder (Coder. ch nick color {})
        out-coders (mapmap clean-coder @coders)
        out-workspaces (mapmap clean-workspace @workspaces)]
    (dosync
     (alter coders merge {(:nick coder) coder}))
    (enqueue ch (encode {:op :status :coders out-coders :workspaces out-workspaces}))
    (encode {:op :connect :coder (clean-coder coder)})))

(declare respond-to)
(declare workspace-commands)

(defn add-coder-to-workspace
  [workspace coder cursor]
  (let [space (:name workspace)
        nick (:nick coder)]
    (dosync
     (if (get @workspaces space)
       (alter workspaces assoc-in [space :cursors nick] cursor)
       (let [joined (assoc-in workspace [:cursors nick] cursor)]
         (alter workspaces assoc space joined)))
     (alter coders assoc-in [nick :cursors space] cursor))))

(defn remove-coder-from-workspace
  [workspace coder]
  (let [space (:name workspace)
        nick (:nick coder)]
    (dosync
     (alter workspaces update-in [space :cursors] #(dissoc % nick))
     (alter coders update-in [nick :cursors] #(dissoc % space)))))

(defn coder-join
  "Joins the coder to the given workspace."
  [ch request]
  (let [space (-> request :workspace keyword)
        nick (-> request :nick keyword)
        coder (get @coders nick)
        pos {:line 0 :ch 0}
        color (:color coder)
        cursor (Cursor. space nick pos color)

        workspace
        (or
         (get @workspaces space)
         (Workspace. (permanent-channel) space [""] {} [] {}))

        ;; coder-ch (fork (:ch coder))
        ;; workspace-ch (fork (:ch workspace))

        coder-ch (:ch coder)
        workspace-ch (:ch workspace)

        decoded (map* decode coder-ch)
        filtered (filter* #(get workspace-commands (-> % :op keyword)) decoded)
        process (map* (respond-to workspace-commands [coder-ch workspace-ch]) filtered)]
    (siphon process (:ch workspace))
    (siphon workspace-ch (:ch coder))
    (add-coder-to-workspace workspace coder cursor)
    (encode {:op :join
             :coder (clean-coder (get @coders nick))
             :workspace (clean-workspace (get @workspaces space))})))

(defn coder-say
  [coder-ch workspace-ch request]
  (encode request))

(defn coder-cursor
  [coder-ch workspace-ch request]
  (let [[space nick workspace coder] (find-coder-workspace request)
        cursor (-> coder :cursors space)]
    (dosync
     (alter workspaces update-in [space :cursors nick :pos] (-> request :cursor constantly))
     (alter coders update-in [nick :cursors space :pos] (-> request :cursor constantly)))
     ;; (alter cursor assoc :pos (request :cursor)))
    (encode (assoc request :cursor (:pos cursor)))))

(defn split-newlines
  [s]
  (let [raw (re-seq #"([^\n]*)\n?" s)]
    (drop-last (map last raw))))

(defn remove-span
  [s from to]
  (str
   (.substring s 0 from)
   (.substring s to (count s))))

(defn update-code
  [code from to text]
  (let [before (-> from :line inc (take code))
        before-line (or (last before) "")
        after (-> to :line (drop code))
        after-line (or (first after) "")
        pre-end (min (count before-line) (:ch from))
        post-end (count after-line)
        post-start (min (:ch to) post-end)
        pre (.substring before-line 0 pre-end)
        post (.substring after-line post-start post-end)
        lines (split-newlines text)
        first-line (first lines)
        center (str pre first-line)
    
        spliced
        (loop [ball (list center)
               remaining (rest lines)]
          (if (empty? remaining)
            (cons (str (first ball) post) (rest ball))
            (recur (cons (first remaining) ball) (rest remaining))))

        updated (concat (drop-last before) (reverse spliced) (rest after))]
    (map println updated)
    updated))

(defn coder-change
  [coder-ch workspace-ch request]
  (let [space (-> request :workspace keyword)
        nick (-> request :nick keyword)
        from (-> request :info :from)
        to (-> request :info :to)
        text (-> request :info :text)]
    (dosync
     (alter
      workspaces update-in [space :code]
      (fn [code]
        (update-code code from to text))))
    (encode request)))

(defn coder-leave
  "Removes the given coder from the workspace"
  [coder-ch workspace-ch request]
  (let [space (-> request :workspace keyword)
        nick (-> request :nick keyword)
        coder (get @coders nick)
        workspace (get @workspaces space)
        response (encode {:op :leave :nick nick :workspace space})]
    (remove-coder-from-workspace workspace coder)
    (enqueue (:ch workspace) response)
    ;; (close coder-ch)
    ;; (close workspace-ch)
    response))

(defn coder-disconnect
  "Removes the given coder from the map and notifies all clients."
  [ch request]
  (let [nick (-> request :nick keyword)
        coder (get @coders nick)]
    (doseq [cursor (:cursors coder)]
      (let [space (:workspace cursor)
            workspace (get @workspaces space)]
        (coder-leave (:ch coder) (:ch workspace) {:workspace space :nick nick})))
    (dosync
     (alter coders dissoc nick))
    (close (:ch coder))
    (encode request)))

(defn respond-to
  [commands channels]
  (fn [request]
    (debug request)
    (let [op (-> request :op keyword)
          command (get commands op)]
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
        filtered (filter* #(get base-commands (-> % :op keyword)) decoded)]
    (siphon (map* (respond-to base-commands [ch]) filtered) broadcast)
    (siphon broadcast ch)))

(defn start-websockets
  "Starts the websocket server."
  [handler port]
  (swank/start-server :host "127.0.0.1" :port 11100)
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
      ""]]
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
  (GET "/a/:path" {params :params} ((-> params :path keyword paths) params))
  (route/not-found (nothing)))

(declare app)

(defn init
  []
  (start-websockets triceratops 11122)
  (def app (handler/site triceratops-routes)))

;; (defn start-frontend
;;   [handler port]
;;   (ring/run-jetty handler {:port port :join? false}))

;; (defn start
;;   []
;;   (start-frontend (var app) 11133)
;;   (start-websockets triceratops 11122))

;; (defn -main []
;;   (start))

