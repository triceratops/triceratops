(ns triceratops.frontend
  (:use [hiccup.core :only (html)]
        [compojure.core :only (defroutes GET)])
  (:require [compojure.route :as route]
            [compojure.handler :as handler]
            [triceratops.core :as core]))

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
  (core/start-triceratops)
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

