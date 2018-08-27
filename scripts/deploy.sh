#!/bin/bash

echo "Start Deployment" 
PRJPATH=$1"/config/packaging/"

## declare an array variable
declare -a arr=("common" "attributes" "categories" "collections" "configuration" "dashboard" "iam" "locations" "products" "tags" "things")

## now loop through the above array
for i in "${arr[@]}"
do
   cd $PRJPATH$i
   echo "Start Deployment "$i
   echo "--------------------------------"
   #echo "Stage: API"
   #sls deploy
   echo "Stage: "$2
   #   sls deploy --alias ng
   #echo "Stage: QC"
   sls deploy --alias $2
   echo "End Deployment "$i
   # or do whatever with individual element of the array
done
