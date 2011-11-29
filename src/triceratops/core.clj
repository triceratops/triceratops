(ns triceratops.core
  (:use [clojure.string :only (split join trim)]
        [cheshire.core :only (generate-string parse-string)]
        [lamina.core :only (permanent-channel enqueue receive siphon map* close)]
        [aleph.http :only (start-http-server)]))

(def broadcast (permanent-channel))
(def workspaces (ref {}))
(def coders (ref {}))

(defn encode
  [structure]
  (generate-string structure))

(defn decode
  "message: the string to be decoded
  Takes a string and interprets it as a structured map."
  [message]
  (parse-string message true))

(defn coder-connect
  "nick: the given nickname of the new coder
  Register the coder with the system."
  [nick]
  (println (str nick " connected"))
  (enqueue broadcast (encode {:op :connect :nick nick})))

(defn respond
  [nick ch raw]
  (let [request (decode raw)]
  (condp = (keyword (request :op))
    :say raw
    :leave (let [close-message (encode {:op :quit})]
             (enqueue ch close-message)
             raw)
    :quit (do (close ch) ""))))

(defn process
  "nick: where this message originated from
  ch: the channel of the incoming message
  This function produces a function which responds to messages,
  given a nick and incoming channel."
  [nick ch]
  (fn [raw]
    (let [response (respond nick ch raw)]
      (println response)
      response)))

(defn coder
  "ch: the newly created channel where messages from this coder will be sent
  handshake: websockets handshake
  Register the new coder and establish the channel it will use to broadcast
  to other coders "
  [ch handshake]
  (receive ch
    (fn [nick]
      (coder-connect nick)
      (siphon
       (map* (process nick ch) ch)
       broadcast)
      (siphon broadcast ch))))

(defn start []
  (start-http-server coder {:port 11122 :websocket true}))

(defn -main []
  (start))

