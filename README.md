Kili.us Server
==========
An open source URL Shortener Service created with Node.js using MongoDB as the backend.

Installing
------------
Kili.us server component requires a few external dependencies. I don't have an installer (a good future enhancement)
nor do I want to include a bunch of 3rd party code in my own repository.

So, here are the installation instructions.

+ Install <a href="http://nodejs.org/">node</a> v.0.8.8 or above
+ Install <a href="http://www.mongodb.org/">mongoDB</a>
+ Create a directory to host Kili.us
+ Run
  >git clone https://github.com/jmhorak/Kilius.git
  >git clone https://github.com/jmhorak/Kilius-client.git
  >git clone https://github.com/jmhorak/promise.js.git
  >npm install Kilius/src/node_modules/node-mongodb-native
+ Open Kilius/options.json to customize
+ If running as an upstart service, edit Kilius/kilius.conf appropriately then copy to /etc/init

Optional Steps
------------
+ Set a google analytics ID in Kilius-client/publish/index.html
+ Set up your web server to forward requests to node.

Running the Server
------------
+ If starting as an upstart service
  >sudo service kilius start
+ Start with CLI
  >node Kilius/kilius.js

Options
------------
There are some deployment options in Kilius/options.json
+ database - The name of the mongodb database to use
+ serverPort - Node server port number. Change to 80 if node does not cohabitate with another web server
+ databaseHost - The mongo server may be on a different machine - this is the hostname for its location
+ databasePort - Port to use to connect to mongo
+ databaseUser - Database user to authenticate
+ databasePassword - Database password
+ throttleLimit - Kilius throttles the number of requests from a single user, use this to set the throttle limit
+ throttleTime - The time limit before the throttling resets in milliseconds
+ statsPageLimit - Requests for previously shortened links are paged at this limit
+ clientRootFilePath - Path to the client files

Unit Tests
------------
The server ships with a full suite of unit tests written for the Jasmine unit testing framework.

Jasmine is not included in deployment. If you wish to run the unit tests, you'll need to install Jasmine and the Jasmine node_module.

+ Jasmine (https://github.com/pivotal/jasmine)
  >mkdir Kilius/lib && pushd Kilius/lib
  >git clone https://github.com/pivotal/jasmine.git
  >popd

+ Jasmine node_module (https://github.com/mhevery/jasmine-node)
  >mkdir Kilius/lib/node_modules && pushd Kilius/lib/node_modules
  >npm install jasmine-node -g
  >popd

You can run the unit tests with the command
  >node Kilius/lib/node_modules/jasmine-node/lib/jasmine-node/cli.js --color --verbose spec/

Author
------------
Jeff Horak
http://jeffhorak.com
@jmhorak
