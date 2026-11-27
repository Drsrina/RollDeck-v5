FROM haxe:3.4 AS builder

WORKDIR /app

RUN haxelib install lime 7.3.0 --always && \
    haxelib install openfl 8.9.0 --always && \
    haxelib install msignal 1.2.5 --always

COPY . .

RUN haxelib run openfl build html5

FROM nginx:alpine
COPY --from=builder /app/Export/html5/bin /usr/share/nginx/html
EXPOSE 80
