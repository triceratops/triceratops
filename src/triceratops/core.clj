(ns triceratops.core
  (:use [lamina.core :only (channel receive siphon map*)])
  (:use [aleph.http :only (start-http-server)]))

(def broadcast (channel))
(def coders (ref {}))

(defn coder [ch handshake]
  (receive ch
    (fn [name]
      (siphon (map* #(str name ": " %) ch) broadcast)
      (siphon broadcast ch))))

(defn start []
  (start-http-server coder {:port 11111 :websocket true}))

(defn -main []
  (start))