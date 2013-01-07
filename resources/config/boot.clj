(use '[caribou.config :only (read-config configure environment)])
(require '[clojure.java.io :as io])

(def default-config
  {:debug        true
   :use-database true
   :halo-enabled false
   :database {:classname    "org.h2.Driver"
              :subprotocol  "h2"
              :host         "localhost"
              :database     "caribou_development"
              :user         "h2"
              :password     ""}
   :public-dir     "public"
   :assets-dir     "caribou/assets"
   :hooks-dir      "caribou/hooks"
   :migrations-dir "caribou/migrations"
   :api-public     "resources/public"
   :controller-ns  "triceratops.controllers"})

(defn submerge
  [a b]
  (if (string? b) b (merge a b)))

(defn get-config
  "Loads the appropritate configuration file based on environment"
  []
  (let [config-file (format "config/%s.clj" (name (environment)))]
    (println "Loading Caribou config " config-file)
    (merge-with submerge default-config (read-config (io/resource config-file)))))

;; This call is required by Caribou
(configure (get-config))


