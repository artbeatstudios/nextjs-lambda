#!/bin/sh

set -e

LAMBDA_FOLDER=nodejs
SHARP_IGNORE_GLOBAL_LIBVIPS=1

mkdir -p dist

npm install \
    --arch=x64 \
    --platform=linux \
    --target=16.15 \
    --libc=glibc \
    --prefix=$LAMBDA_FOLDER \
    --ignore-scripts=false \
    --verbose \
    sharp

zip -q -r dist/sharp-layer.zip $LAMBDA_FOLDER

rm -rf $LAMBDA_FOLDER
rm -rf .webpack/node_modules

# we want to unzip too so it can be bundled into lambda code package
unzip dist/sharp-layer.zip -d .webpack
mv .webpack/nodejs/node_modules .webpack
mv .webpack/nodejs/* .webpack
rm -rf .webpack/nodejs

# after we've unpacked and include node_modules we can zip it all back up
zip dist/image-handler.zip -r .webpack/*