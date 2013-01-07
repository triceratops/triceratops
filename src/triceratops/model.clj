(ns triceratops.model
  (:require [clojure.java.jdbc :as sql]
            [caribou.model :as model]
            [caribou.migration :as migration]))

(defn create-workspace-model
  []
  (model/create
   :model
   {:name "Workspace"
    :fields
    [{:name "Name" :type "string"}
     {:name "Code" :type "text"}]}))

(defn create-coder-model
  []
  (model/create
   :model
   {:name "Coder"
    :fields
    [{:name "Nick" :type "string"}
     {:name "Color" :type "string"}]}))

(defn initial-migration
  [config]
  (migration/lay-model-base config)
  (model/init)
  (sql/with-connection config
    (create-workspace-model)
    (create-coder-model)))
