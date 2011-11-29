(ns triceratops.core
  (:use [clojure.string :only (split join trim)]
        [lamina.core :only (permanent-channel enqueue receive siphon map* close)]
        [aleph.http :only (start-http-server)]))

(def broadcast (permanent-channel))
(def workspaces (ref {}))
(def coders (ref {}))

(defn coder-connect
  "nick: the given nickname of the new coder
  Register the coder with the system."
  [nick]
  (println (str nick " connected"))
  (enqueue broadcast (str ":connect " nick)))

(defn respond
  [nick ch message]
  (let [parts (split (trim message) #" +")]
    (condp = (first parts)
      ":say" (join " " (concat [(first parts) nick] (rest parts)))
      ":leave" (do
                 (enqueue ch ":close")
                 (str message " " nick))
      ":close" (do (close ch) ""))))

(defn process
  "nick: where this message originated from
  ch: the channel of the incoming message
  This function produces a function which responds to messages,
  given a nick and incoming channel."
  [nick ch]
  (fn [message]
    (let [response (respond nick ch message)]
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

