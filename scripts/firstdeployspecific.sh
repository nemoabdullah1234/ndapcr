#!/bin/bash


gnome-terminal -x bash -c "export AWS_CLIENT_TIMEOUT=3600000; cd ../config/packaging/$1; pwd; sls deploy; sls deploy --alias qc; sls deploy --alias ng; sls deploy --alias api; bash"; 

