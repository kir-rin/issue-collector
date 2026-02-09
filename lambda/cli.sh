#!/bin/sh
case "$1" in
	login)
		aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
		;;
  build)
		docker rmi $(docker images -aq)
		docker buildx build --platform linux/arm64 --provenance=false -f lambda/Dockerfile.local -t docker-image:test .
    ;;
  run)
		docker run --platform linux/arm64 -p 9000:8080 -p 5678:5678 --rm --name ic docker-image:test 
    ;;
  test)
		curl "http://localhost:9000/2015-03-31/functions/function/invocations" -d @payload.json                  
    ;;
esac

