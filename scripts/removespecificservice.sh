#!/bin/bash


gnome-terminal -x bash -c "export AWS_CLIENT_TIMEOUT=3600000; cd ../config/packaging/$1; pwd; serverless alias remove --alias=qc; serverless alias remove --alias=ng; serverless alias remove --alias=api; bash"; 

