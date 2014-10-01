(defproject decide "1.0.0-alpha.3"
  :description "FIXME: write this!"
  :url "http://example.com/FIXME"

  :dependencies [[org.clojure/clojure "1.6.0"]
                 [org.clojure/clojurescript "0.0-2173"]
                 [org.clojure/core.async "0.1.303.0-886421-alpha"]]

  :plugins [[lein-cljsbuild "1.0.2"]]

  :source-paths ["src"]

  :cljsbuild {:builds
              [{:source-paths ["src/host" "src/decide"]
                :compiler
                {:output-to "scripts/decide-host.js"
                 :optimizations :simple
                 :pretty-print true
                 :target :nodejs}}
               {:source-paths ["src/babysitter" "src/decide"]
                :compiler
                {:output-to "scripts/decide-babysitter.js"
                 :optimizations :simple
                 :pretty-print true
                 :target :nodejs}}]})