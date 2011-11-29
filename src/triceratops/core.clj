(ns triceratops.core
  (:use [clojure.string :only (split join trim)]
        [cheshire.core :only (generate-string parse-string)]
        [lamina.core :only (permanent-channel enqueue receive siphon map* close)]
        [aleph.http :only (start-http-server)]))

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

(defn coder-connect
  "Registers the coder with the system based on the given request."
  [request]
  (println (str (request :message) " connected"))
  (enqueue broadcast (encode {:op :connect :nick (request :message)})))

(defn respond
  "Responds to the incoming raw message in various ways based on the value of :op,
  potentially adding messages back into ch."
  [ch raw]
  (let [request (decode raw)]
  (condp = (keyword (request :op))
    :identify (do (coder-connect request) raw)
    :say raw
    :disconnect (let [close-message (encode {:op :quit})]
                  (enqueue ch close-message)
                  raw)
    :quit (do (close ch) ""))))

(defn process
  "Produces a function which responds to incoming messages,
  sometimes sending messages back along this same channel."
  [ch]
  (fn [raw]
    (let [response (respond ch raw)]
      (println response)
      response)))

(defn coder
  "Registers the new coder with the system and establishes
  the channel it will use to broadcast to other coders."
  [ch handshake]
  (siphon
   (map* (process ch) ch)
   broadcast)
  (siphon broadcast ch))

(defn start
  "Starts the websocket server."
  [handler port]
  (start-http-server handler {:port port :websocket true}))

(defn -main []
  (start coder 11122))

