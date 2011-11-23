(ns triceratops.core
  (:use [lamina.core :only (channel enqueue receive siphon map*)])
  (:use [aleph.http :only (start-http-server)]))

(def broadcast (channel))
(def coders (ref {}))

(defn coder [ch handshake]
  (receive ch
    (fn [name]
      (println (str name " joined"))
      (enqueue broadcast (str ":join " name))
      (siphon
       (map*
        #(let [m (if % (str name ": " %) (str name " left"))]
           (println m)
           m)
        ch)
       broadcast)
      (siphon broadcast ch))))

(defn start []
  (start-http-server coder {:port 11122 :websocket true}))

(defn -main []
  (start))

