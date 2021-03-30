#!/bin/bash

origDir=`pwd`

if [[ -d frontend ]]
then
	cd frontend;
fi

if [[ -d develop ]]
then
	cd develop;
fi

cd ..;

git rev-parse --short HEAD > public/fe_version
yarn install && rm -rf dist && yarn build && rm -rf ../src/public && cp -r dist ../src/public && rm public/fe_version


cd $origDir;
