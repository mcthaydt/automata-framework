#!/bin/bash
# usage: shoot-af.sh <tree> <outdir>
export PATH=/opt/node24x/bin:$PATH
TREE=$1; OUT=$2
STEPS='-:face:180;-:walk:0.6,6.0;hall-south:walk:0.6,6.5;-:walk:0,-4.6;corridor:walk:0,-4;-:tap:cabinet;-:code:2000;-:tap:closetDoor;-:press:Close;-:walk:3.1,-5.0;closet:walk:3.1,-4.6'
cd $TREE/games/the-last-light
for SIZE in 844x390 1024x768; do
  AF_WEBGPU=software AF_SHOOT=$OUT/$SIZE AF_SHOOT_SIZE=$SIZE AF_SHOOT_STEPS="$STEPS" timeout 2400 pnpm test:e2e --grep "play frames" --trace off > $OUT/$SIZE.log 2>&1
  echo "$SIZE exit $?" >> $OUT/done.txt
done
