(ns triceratops.core
  (:use [clojure.string :only (split join trim)]
        [cheshire.core :only (generate-string parse-string)]
        [compojure.core :only (defroutes GET)]
        [hiccup.core :only (html)]
        [lamina.core :only (permanent-channel enqueue receive siphon map* close)]
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
  (parse-string message true))

(defrecord Coder [nick color cursor history])

(defn coder-connect
  "Registers the coder with the system based on the given request."
  [ch request]
  (let [coder (Coder. (request :message) "#1155cc" {:line 0 :ch 0} [])]
    (dosync
     (alter coders merge {(keyword (:nick coder)) coder}))
    (enqueue ch (encode {:op :coders :coders @coders}))
    (encode {:op :connect :nick (:nick coder)})))

(defn coder-disconnect
  "Removes the given coder from the map and notifies all clients."
  [ch raw request]
  (dosync
   (alter coders dissoc (keyword (request :nick))))
  (enqueue ch (encode {:op :quit}))
  raw)

(defn coder-cursor
  [ch raw request]
  (dosync
   (alter coders assoc-in [(keyword (request :nick)) :cursor] (request :cursor)))
  raw)

(defn coder-change
  [ch raw request]
  raw)

(defn respond
  "Responds to the incoming raw message in various ways based on the value of :op,
  potentially adding messages back into ch."
  [ch raw]
  (let [request (decode raw)]
    (condp = (keyword (request :op))
      :identify (coder-connect ch request)
      :say raw
      :cursor (coder-cursor ch raw request)
      :code (coder-change ch raw request)
      :disconnect (coder-disconnect ch raw request)
      :quit (do (close ch) ""))))

(defn process
  "Produces a function which responds to incoming messages,
  sometimes sending messages back along this same channel."
  [ch]
  (fn [raw]
    (let [response (respond ch raw)]
      (println response)
      response)))

(defn triceratops
  "Registers the new coder with the system and establishes
  the channel it will use to broadcast to other coders."
  [ch handshake]
  (siphon (map* (process ch) ch) broadcast)
  (siphon broadcast ch))

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
     [:script {:src "/js/routing.js"}]
     [:script {:src "/js/triceratops.js"}]
     [:link {:rel "stylesheet" :href "/css/triceratops.css"}]]
    [:body 
     {:onload "triceratops.hatch()"
      :onbeforeunload "triceratops.die()"}
     [:div#triceratops]]]))

(defn home
  [params]
  (html
   [:div#home
    [:p "WELCOME TO TRICERATOPS"]
    [:div#nick
     [:label "what is your name?"]
     [:input {:type "text"}]]
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

