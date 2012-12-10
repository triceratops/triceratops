(defproject triceratops "0.0.1"
  :description "collaborative realtime livecoding in the browser"
  :dependencies [[org.clojure/clojure "1.3.0"]
                 [aleph "0.3.0-beta8"]
                 [compojure "1.1.3"]
                 [hiccup "1.0.2"]
                 [cheshire "5.0.1"]
                 [swank-clojure "1.4.2" :exclusions [clj-stacktrace]]]
  :jvm-opts ["-agentlib:jdwp=transport=dt_socket,server=y,suspend=n"]
  :ring {:handler triceratops.core/app
         :servlet-name "fuelgame-frontend"
         :init triceratops.core/init
         :port 11133}
  :main triceratops.core)

