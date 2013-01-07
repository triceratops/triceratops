(defproject triceratops "0.0.2"
  :description "collaborative realtime livecoding in the browser"
  :dependencies [[org.clojure/clojure "1.3.0"]
                 [org.clojure/java.jdbc "0.2.3"]
                 [aleph "0.3.0-beta8"]
                 [compojure "1.1.3"]
                 [hiccup "1.0.2"]
                 [cheshire "5.0.1"]
                 [antler/caribou-core "0.7.17"]
                 [swank-clojure "1.4.2" :exclusions [clj-stacktrace]]]
  :jvm-opts ["-agentlib:jdwp=transport=dt_socket,server=y,suspend=n"]
  :ring {:handler triceratops.frontend/app
         :servlet-name "fuelgame-frontend"
         :init triceratops.frontend/init
         :port 11133}
  :main triceratops.core)

