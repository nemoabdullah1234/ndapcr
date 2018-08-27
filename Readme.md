Steps :

1) Install node dependency.

2) Clone project

git clone ssh://git-codecommit.us-east-1.amazonaws.com/v1/repos/ak-node-api-core ak-node-api-core

cd ak-node-api-core

cp config.production.js config.development.js

npm install

3) Set up environment variable

vim ~/.bashrc

Add below line at the end.

export NODE_ENV=development [ in dev env ]
export NODE_ENV=production [ in prod env ]

4) Run server

node server.js
