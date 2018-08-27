#!/bin/bash

cd ../config/packaging/
for file in ./*/ ; do 
export AWS_CLIENT_TIMEOUT=3600000;
cd $file; 
cd ../$file;
echo $file; 
sls deploy --alias $1; 
done

