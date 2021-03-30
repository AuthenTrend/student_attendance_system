#!/bin/bash

docker rm -f frontend
docker run -idt --name frontend -p 80:80 nginx:1.13-alpine
docker cp nginx.conf frontend:/etc/nginx/nginx.conf
docker exec frontend sh -c "kill -1 1"
