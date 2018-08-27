#!/bin/bash

for file in ../config/packaging/*/ ; do 
gnome-terminal -x bash -c "export AWS_CLIENT_TIMEOUT=3600000; cd $file; sls deploy --alias qc; sls deploy --alias ng; sls deploy --alias api; bash"; done

