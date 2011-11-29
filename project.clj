(defproject triceratops "1.0.0-SNAPSHOT"
  :description "collaborative realtime livecoding in the browser"
  :dependencies [[org.clojure/clojure "1.3.0"]
                 [org.clojure/algo.generic "0.1.1-SNAPSHOT"]
                 [org.clojars.smallrivers/aleph "0.2.1-SNAPSHOT"]
                 [ring/ring-jetty-adapter "0.3.10"]
                 [compojure "0.6.4"]
                 [hiccup "0.3.7"]
                 [cheshire "2.0.3"]]
  :dev-dependencies [[swank-clojure "1.4.0-SNAPSHOT"]
                     [backtype/autodoc "0.9.0-SNAPSHOT"]]
  :main triceratops.core
  :repositories {"sonatype-oss-public" "https://oss.sonatype.org/content/groups/public/"
                 "sonatype-oss-snapshots" "https://oss.sonatype.org/content/repositories/snapshots/"})
