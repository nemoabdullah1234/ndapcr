#!/bin/bash

for file in ../config/packaging/*/ ; do 
gnome-terminal -x bash -c "export AWS_CLIENT_TIMEOUT=3600000; cd $file; echo $file; sls deploy --alias $1; bash"; done

