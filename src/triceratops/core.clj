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
    (println (str (:nick coder) " connected"))
    (enqueue ch (encode {:op :coders :coders @coders}))
    (encode {:op :connect :nick (:nick coder)})))

(defn coder-disconnect
  "Removes the given coder from the map and notifies all clients."
  [ch raw request]
  (dosync
   (alter coders dissoc (keyword (request :nick))))
  (enqueue ch (encode {:op :quit}))
  raw)

(defn respond
  "Responds to the incoming raw message in various ways based on the value of :op,
  potentially adding messages back into ch."
  [ch raw]
  (let [request (decode raw)]
    (condp = (keyword (request :op))
      :identify (coder-connect ch request)
      :say raw
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

(defn layout
  [title block]
  (html
   [:html
    [:head
     [:title title]
     [:script {:src "/js/json2.js"}]
     [:script {:src "/js/underscore.js"}]
     [:script {:src "/js/jquery.js"}]
     [:script {:src "/js/codemirror/lib/codemirror.js"}]
     [:link {:rel "stylesheet" :href "/js/codemirror/lib/codemirror.css"}]
     [:script {:src "/js/codemirror/mode/javascript/javascript.js"}]
     [:link {:rel "stylesheet" :href "/js/codemirror/theme/default.css"}]
     [:script {:src "/js/Three.js"}]
     [:script {:src "/js/triceratops.js"}]
     [:style {:type "text/css"} "\n  .CodeMirror {border-top: 1px solid black; border-bottom: 1px solid black;}\n  .activeline {background: #f0fcff !important;}"]]
    block]))

(defn home
  [params]
  (layout
   "TRICERATOPS"
   [:body {:onload "triceratops.home()"}
    [:div
     [:p "WELCOME TO TRICERATOPS"]
     [:label "funnel to workspace"]
     [:input#funnel {:type "text"}]]]))

(defn workspace
  [params]
  (layout
   (str "TRICERATOPS --- " (params :workspace))
   [:body
    {:onload (str "triceratops.hatch('" (params :workspace) "')")
     :onbeforeunload "triceratops.die()"}
    [:div#pre
     [:label "what is your name?"]
     [:input#name {:type "text"}]]
    [:div#workspace
     [:div#chat
      [:input#voice {:type "text"}]
      [:div#out]]
     [:div#coders
      [:p "other coders"]
      [:ul]]
     [:form
      [:textarea#code {:name "code"}
       "var yellow = {wowowowow: 'hwhwhwhwhwhwhwhw'}"]]
     [:div#gl]]]))

(defn nothing
  []
  "you have reached an edge of this world where nothing exists")

(defroutes triceratops-routes
  (route/files "/" {:root "resources/public"})
  (GET "/" {params :params} (home params))
  (GET "/w/:workspace" {params :params} (workspace params))
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

