(ns triceratops.core
  (:use [clojure.string :only (split join trim)]
        [lamina.core :only (channel permanent-channel enqueue receive siphon map* close)]
        [aleph.http :only (start-http-server)]))

(def broadcast (permanent-channel))
(def coders (ref {}))

(defn process [name ch]
  (fn [message]
    (let [parts (split (trim message) #" +")]
      (println message)
      (condp = (first parts)
        ":say" (join " " (concat [(first parts) name] (rest parts)))
        ":leave" (do
                   (enqueue ch ":close")
                   (str message " " name))
        ":close" (do (close ch) "")))))

(defn coder [ch handshake]
  (receive ch
    (fn [name]
      (println (str name " joined"))
      (enqueue broadcast (str ":join " name))
      (siphon
       (map* (process name ch) ch)
       broadcast)
      (siphon broadcast ch))))

(defn start []
  (start-http-server coder {:port 11122 :websocket true}))

(defn -main []
  (start))

