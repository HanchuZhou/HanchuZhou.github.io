(function () {
  'use strict';
  var triggers = Array.from(document.querySelectorAll('.destroy-trigger'));
  var page = document.querySelector('body > .wrapper');
  if (!triggers.length || !page) return;
  var active = false;
  var playbackSpeed = 1.5;
  var sprite = new Image();
  sprite.src = './assets/img/destruction/explosion-sheet.png';
  var catImage = new Image();
  catImage.src = './assets/img/destruction/original-cat-cutout.png';
  var launcherImage = new Image();
  launcherImage.src = './assets/img/destruction/rpg-photo-cutout.png';
  var projectileImage = new Image();
  projectileImage.src = './assets/img/destruction/rpg-photo-projectile.png';

  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function smooth(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function noise(n) { var x = Math.sin(n * 127.1 + 17.7) * 43758.5453; return x - Math.floor(x); }

  triggers.forEach(function (trigger) { trigger.addEventListener('click', function () { start(trigger); }); });

  async function start(trigger) {
    if (active) return;
    active = true;
    triggers.forEach(function (button) { button.disabled = true; });
    var controller = new AbortController();
    var animations = [];
    var frame;
    var scene;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var width = window.innerWidth;
    var height = window.innerHeight;
    var playingVideos = Array.from(page.querySelectorAll('video')).filter(function (v) { return !v.paused; });
    var scrollX = window.scrollX;
    var scrollY = window.scrollY;
    var previousInert = page.inert;

    function restore() {
      if (controller.signal.aborted) return;
      controller.abort();
      animations.forEach(function (animation) { animation.cancel(); });
      cancelAnimationFrame(frame);
      if (scene) scene.remove();
      document.body.classList.remove('destruction-active');
      page.inert = previousInert;
      active = false;
      triggers.forEach(function (button) { button.disabled = false; });
      trigger.focus({ preventScroll: true });
      playingVideos.forEach(function (video) { video.play().catch(function () {}); });
    }
    function animate(element, keys, duration, easing) {
      var animation = element.animate(keys, { duration: (reduced ? Math.min(duration, 220) : duration) / playbackSpeed, easing: easing || 'ease-in-out', fill: 'forwards' });
      animations.push(animation);
      animation.finished.catch(function () {});
      return animation.finished;
    }
    // One frame loop owns each phase; cancellation stops both drawing and its promise.
    function run(duration, draw, speed) {
      duration /= speed === undefined ? playbackSpeed : speed;
      return new Promise(function (resolve, reject) {
        if (controller.signal.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
        var startTime = performance.now();
        function abort() { cancelAnimationFrame(frame); reject(new DOMException('Cancelled', 'AbortError')); }
        controller.signal.addEventListener('abort', abort, { once: true });
        function tick(now) {
          var progress = clamp((now - startTime) / duration);
          draw(progress);
          if (progress < 1) frame = requestAnimationFrame(tick);
          else { controller.signal.removeEventListener('abort', abort); resolve(); }
        }
        frame = requestAnimationFrame(tick);
      });
    }

    try {
      // Keep the real page visible while preparing its single, stable paper texture.
      await Promise.all([catImage.decode(), launcherImage.decode(), projectileImage.decode()]);
      var texture = await html2canvas(document.body, {
        // Crop in document coordinates while keeping the cloned viewport at the
        // actual scroll position, including the sticky profile card.
        width: width, height: height, x: scrollX, y: scrollY,
        windowWidth: width, windowHeight: height, scrollX: scrollX, scrollY: scrollY,
        scale: Math.min(window.devicePixelRatio || 1, 1.25),
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        logging: false, useCORS: true,
        onclone: function (doc) {
          // html2canvas predates CSS Color 4; flatten the translucent header only in the capture.
          var header = doc.querySelector('header');
          if (header) header.style.background = getComputedStyle(document.documentElement).getPropertyValue('--surface');
          doc.querySelectorAll('video').forEach(function (video, index) {
            var original = document.querySelectorAll('video')[index];
            if (!original || !original.videoWidth) return;
            var still = doc.createElement('canvas');
            still.width = original.videoWidth;
            still.height = original.videoHeight;
            still.className = video.className;
            still.style.cssText = video.style.cssText;
            try { still.getContext('2d').drawImage(original, 0, 0); video.replaceWith(still); } catch (_) { /* Keep the video placeholder. */ }
          });
        }
      });
      scene = document.createElement('div');
      scene.className = 'destruction-scene';
      scene.dataset.explosion = 'fireball';
      scene.setAttribute('role', 'dialog');
      scene.setAttribute('aria-modal', 'true');
      scene.setAttribute('aria-label', 'Destroy this page animation');
      scene.innerHTML = '<button type="button" class="destruction-close">Restore page · Esc</button><canvas class="destruction-paper" aria-hidden="true"></canvas><div class="destruction-cat"><img class="destruction-cat-photo" src="' + catImage.src + '" alt="Original helmet-wearing meme cat"><div class="destruction-launcher"><img src="' + launcherImage.src + '" alt="RPG photograph"><span class="destruction-muzzle"></span></div></div><div class="destruction-rocket" aria-hidden="true"><img src="./assets/img/destruction/rpg-photo-projectile.png" alt=""></div><canvas class="destruction-explosion" aria-hidden="true"></canvas><div class="destruction-ending" hidden><button type="button" class="destruction-restore">Bring it back</button></div>';
      var paper = scene.querySelector('.destruction-paper');
      var paperContext = paper.getContext('2d', { alpha: false });
      var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      paper.width = width * ratio;
      paper.height = height * ratio;
      paperContext.scale(ratio, ratio);
      var mesh = createPaper(texture, width, height);
      mesh.draw(paperContext, 0, 0, 0, 0);
      document.body.append(scene);
      document.body.classList.add('destruction-active');
      page.inert = true;
      playingVideos.forEach(function (video) { video.pause(); });
      var close = scene.querySelector('.destruction-close');
      var ending = scene.querySelector('.destruction-ending');
      var cat = scene.querySelector('.destruction-cat');
      var rocket = scene.querySelector('.destruction-rocket');
      close.focus();
      close.addEventListener('click', restore);
      ending.querySelector('button').addEventListener('click', restore);
      scene.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') restore();
        if (event.key === 'Tab') {
          var last = ending.style.pointerEvents === 'auto' ? ending.querySelector('button') : close;
          if (event.shiftKey && document.activeElement === close) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); close.focus(); }
        }
      });
      scene.dataset.stage = 'crumpling';
      await run(reduced ? 220 : 1550, function (t) { mesh.draw(paperContext, t, 0, 0, 0); });
      scene.dataset.stage = 'toss';
      var entranceDuration = reduced ? 120 : 430;
      var rocketDuration = reduced ? 140 : 270;
      var airDuration = entranceDuration + rocketDuration;
      var entryDistance = cat.getBoundingClientRect().height + height * .18;
      var fired = false;
      var startX, startY, angle;
      // The ball follows one uninterrupted upward arc, including during the shot.
      function ballPosition(progress) {
        return { x: width / 2 + width * .2 * progress,
          y: height * .53 - height * .43 * progress + height * .12 * progress * progress };
      }
      var hit = ballPosition(1);
      await run(airDuration, function (progress) {
        var elapsed = progress * airDuration;
        var position = ballPosition(progress);
        mesh.draw(paperContext, 1, position.x - width / 2, position.y - height * .53, reduced ? 0 : progress * 8);
        if (!fired) {
          var entry = clamp(elapsed / entranceDuration);
          // Fast rise from below the viewport, followed by a short gentle deceleration.
          cat.style.transform = 'translateY(' + (entryDistance * Math.pow(1 - entry, 3)) + 'px)';
          if (elapsed >= entranceDuration) {
            fired = true;
            scene.dataset.stage = 'rocket';
            var muzzle = cat.querySelector('.destruction-muzzle').getBoundingClientRect();
            startX = muzzle.left + muzzle.width / 2;
            startY = muzzle.top + muzzle.height / 2;
            angle = Math.atan2(hit.y - startY, hit.x - startX) * 180 / Math.PI;
            rocket.style.left = (startX - 45) + 'px';
            rocket.style.top = (startY - 12) + 'px';
            rocket.style.opacity = '1';
            animate(cat, [{ transform: 'translateY(0)' }, { transform: 'translate(-7px, 3px) rotate(-2deg)' }, { transform: 'translateY(0)' }], 160);
          }
        }
        if (fired) {
          var travel = clamp((elapsed - entranceDuration) / rocketDuration);
          var acceleration = travel * travel;
          rocket.style.transform = 'translate(' + (hit.x - startX) * acceleration + 'px,' + (hit.y - startY) * acceleration + 'px) rotate(' + angle + 'deg)';
        }
      });
      rocket.hidden = true;
      // The paper canvas is opaque for stable rendering; hide it only after impact.
      paper.hidden = true;
      scene.dataset.stage = 'explosion';
      await explode(scene.querySelector('.destruction-explosion'), hit.x, hit.y, reduced, run);
      await animate(cat, [{ opacity: 1 }, { opacity: 0 }], 200);
      ending.hidden = false;
      await animate(ending, [{ opacity: 0 }, { opacity: 1 }], 180);
      scene.dataset.stage = 'finished';
      ending.style.pointerEvents = 'auto';
      ending.querySelector('button').focus();
    } catch (error) {
      if (error.name !== 'AbortError') { console.error('Page animation failed:', error); restore(); }
    }
  }

  function createPaper(texture, width, height) {
    var columns = 12, rows = 10;
    var vertices = [], faces = [];
    var ballRadius = Math.min(58, width * .13);
    for (var row = 0; row <= rows; row++) {
      for (var col = 0; col <= columns; col++) {
        var id = row * (columns + 1) + col;
        var u = col / columns, v = row / rows;
        if (col > 0 && col < columns) u += (noise(id) - .5) * .05;
        if (row > 0 && row < rows) v += (noise(id + 321) - .5) * .06;
        var longitude = u * Math.PI * 3.8 + v * .8;
        var latitude = (.08 + v * .84) * Math.PI;
        var radius = ballRadius * (.82 + noise(id + 74) * .28);
        vertices.push({ x: u * width, y: v * height, u: u, v: v,
          bx: Math.sin(latitude) * Math.cos(longitude) * radius,
          by: Math.cos(latitude) * radius,
          bz: Math.sin(latitude) * Math.sin(longitude) * radius,
          delay: (1 - Math.max(Math.abs(u - .5), Math.abs(v - .5)) * 2) * .21 + noise(id + 53) * .09,
          phase: noise(id + 8) * Math.PI * 2 });
      }
    }
    for (var r = 0; r < rows; r++) for (var c = 0; c < columns; c++) {
      var a = r * (columns + 1) + c, b = a + 1, d = a + columns + 1, e = d + 1;
      if ((r + c) % 2) { faces.push([a,b,d], [b,e,d]); } else { faces.push([a,b,e], [a,e,d]); }
    }
    // Pre-crop each triangle's texture bounds once, keeping frame drawing inexpensive.
    faces = faces.map(function (indices) {
      var points = indices.map(function (i) { return vertices[i]; });
      var minX = Math.min.apply(null, points.map(function (v) { return v.u * texture.width; }));
      var minY = Math.min.apply(null, points.map(function (v) { return v.v * texture.height; }));
      var maxX = Math.max.apply(null, points.map(function (v) { return v.u * texture.width; }));
      var maxY = Math.max.apply(null, points.map(function (v) { return v.v * texture.height; }));
      var tile = document.createElement('canvas');
      tile.width = Math.ceil(maxX - minX) + 2; tile.height = Math.ceil(maxY - minY) + 2;
      tile.getContext('2d').drawImage(texture, minX, minY, tile.width, tile.height, 0, 0, tile.width, tile.height);
      return { indices: indices, tile: tile, source: points.map(function (p) { return { x: p.u * texture.width - minX, y: p.v * texture.height - minY }; }) };
    });
    return { draw: function (context, t, dx, dy, spin) {
      context.fillStyle = '#000'; context.fillRect(0,0,width,height);
      if (t === 0) { context.drawImage(texture,0,0,width,height); return; }
      var rotation = spin + Math.sin(t * 5) * .15 * smooth(t);
      var projected = vertices.map(function (v) {
        var progress = smooth((t - v.delay) / (1 - v.delay));
        // Each region buckles at a different time. Depth reversals make local folds,
        // while shared vertices keep the paper connected rather than turning to shards.
        var buckle = Math.sin(progress * Math.PI);
        var x = (v.x - width / 2) * (1 - progress) + v.bx * progress;
        var y = (v.y - height / 2) * (1 - progress) + v.by * progress;
        var z = v.bz * progress + Math.sin(v.u * 15 + v.v * 11 + t * 5) * Math.min(width,height) * .26 * buckle;
        x += Math.sin(v.v * 14 + v.phase * .35 + progress * 5) * width * .1 * buckle;
        y += Math.cos(v.u * 12 + v.phase * .35 + progress * 4) * height * .09 * buckle;
        var perspective = 950 / (950 + z);
        var rx = x * Math.cos(rotation) - y * Math.sin(rotation);
        var ry = x * Math.sin(rotation) + y * Math.cos(rotation);
        return { x: width / 2 + dx + rx * perspective, y: height / 2 + height * .03 * smooth(t) + dy + ry * perspective, z: z };
      });
      var ordered = faces.map(function (face) { return {face: face, z: face.indices.reduce(function (sum,i) {return sum + projected[i].z;},0)}; });
      ordered.sort(function (a,b) { return b.z - a.z; });
      ordered.forEach(function (entry) {
        var face = entry.face;
        var dest = face.indices.map(function (i) { return projected[i]; });
        var s = face.source;
        var denominator = s[0].x * (s[1].y-s[2].y) + s[1].x * (s[2].y-s[0].y) + s[2].x * (s[0].y-s[1].y);
        if (Math.abs(denominator) < .001) return;
        function coefficient(key) {
          return [
            (dest[0][key]*(s[1].y-s[2].y)+dest[1][key]*(s[2].y-s[0].y)+dest[2][key]*(s[0].y-s[1].y))/denominator,
            (dest[0][key]*(s[2].x-s[1].x)+dest[1][key]*(s[0].x-s[2].x)+dest[2][key]*(s[1].x-s[0].x))/denominator,
            (dest[0][key]*(s[1].x*s[2].y-s[2].x*s[1].y)+dest[1][key]*(s[2].x*s[0].y-s[0].x*s[2].y)+dest[2][key]*(s[0].x*s[1].y-s[1].x*s[0].y))/denominator
          ];
        }
        var tx=coefficient('x'), ty=coefficient('y');
        context.save(); context.beginPath();
        var cx=(dest[0].x+dest[1].x+dest[2].x)/3, cy=(dest[0].y+dest[1].y+dest[2].y)/3;
        // Subpixel overlap seals antialiasing seams; no opacity or element swaps.
        dest.forEach(function (p,i) { var vx=p.x-cx,vy=p.y-cy,len=Math.hypot(vx,vy)||1; var px=p.x+vx/len*.55,py=p.y+vy/len*.55; if(i===0)context.moveTo(px,py);else context.lineTo(px,py); });
        context.closePath(); context.clip();
        context.transform(tx[0],ty[0],tx[1],ty[1],tx[2],ty[2]);
        var area = (dest[1].x-dest[0].x)*(dest[2].y-dest[0].y)-(dest[1].y-dest[0].y)*(dest[2].x-dest[0].x);
        if (area < 0) {
          // As the paper folds over, reveal its unprinted underside.
          context.fillStyle = '#e9e7df';
          context.fillRect(0,0,face.tile.width,face.tile.height);
        } else context.drawImage(face.tile,0,0);
        context.restore();
        var shade = (Math.sin(face.indices[0]*2.3) * .5 + .5) * .38 * smooth(t * 2);
        context.fillStyle='rgba(0,0,0,'+shade+')'; context.beginPath(); context.moveTo(dest[0].x,dest[0].y);context.lineTo(dest[1].x,dest[1].y);context.lineTo(dest[2].x,dest[2].y);context.closePath();context.fill();
      });
    }};
  }

  async function explode(canvas, x, y, reduced, run) {
    var context = canvas.getContext('2d');
    if (!context) return;
    var width=window.innerWidth,height=window.innerHeight,ratio=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=width*ratio; canvas.height=height*ratio; context.scale(ratio,ratio);
    var radius=Math.max(width,height)*.83;
    var duration=reduced?500:1900;
    var sparks=Array.from({length:reduced?40:260},function(_,i){var angle=noise(i+5)*Math.PI*2;var speed=radius*(.12+noise(i+62)*.85);return{dx:Math.cos(angle)*speed,dy:Math.sin(angle)*speed,size:1+noise(i+36)*4,delay:noise(i+94)*.13};});
    var clouds=Array.from({length:22},function(_,i){var angle=noise(i+341)*Math.PI*2;return{dx:Math.cos(angle)*radius*.2*noise(i+92),dy:Math.sin(angle)*radius*.17*noise(i+53),size:.38+noise(i+64)*.34,delay:noise(i+23)*.15};});
    await run(duration,function(t){
      context.clearRect(0,0,width,height);
      var expansion=1-Math.pow(1-t,4);
      var fade=Math.pow(1-t,1.6);
      context.globalCompositeOperation='lighter';
      var glowRadius=Math.max(1,radius*expansion);
      var glow=context.createRadialGradient(x,y,0,x,y,glowRadius);
      glow.addColorStop(0,'rgba(255,245,215,'+fade*.75+')');
      glow.addColorStop(.25,'rgba(255,100,12,'+fade*.65+')');
      glow.addColorStop(1,'rgba(0,0,0,0)');
      context.fillStyle=glow;context.fillRect(0,0,width,height);
      // Offset, overlapping sprite bursts turn the single small effect into turbulent fire.
      if(sprite.complete && sprite.naturalWidth){
        clouds.forEach(function(cloud){
          var local=clamp((t-cloud.delay)/(1-cloud.delay));
          if(local<=0)return;
          var index=Math.min(63,Math.floor(local*64));
          var size=radius*cloud.size*(.5+expansion*.7);
          context.drawImage(sprite,index%8*128,Math.floor(index/8)*128,128,128,x+cloud.dx*expansion-size*.5,y+cloud.dy*expansion-size*.72,size,size);
        });
        context.globalAlpha=1;
      }
      var rings=1;
      for(var ring=0;ring<rings;ring++){
        var rt=clamp((t-ring*.065)*1.7);if(rt<=0||rt>=1)continue;
        var rr=Math.max(1,radius*(1-Math.pow(1-rt,3)));
        context.strokeStyle='rgba(255,185,95,'+(1-rt)*.65+')';
        context.lineWidth=(1-rt)*4+1;
        context.beginPath();context.ellipse(x,y,rr,rr*.8,-.1,0,Math.PI*2);context.stroke();
      }
      sparks.forEach(function(p,i){
        var local=clamp((t-p.delay)/(1-p.delay));if(!local)return;
        var motion=1-Math.pow(1-local,3);
        var px=x+p.dx*motion,py=y+p.dy*motion+local*local*height*.15;
        context.strokeStyle='rgba(255,'+(130+i%100)+',50,'+fade+')';
        context.lineWidth=p.size*(1-local)+.3;context.beginPath();context.moveTo(px,py);context.lineTo(px-p.dx*.045*(1-local),py-p.dy*.045*(1-local));context.stroke();
      });
      context.globalCompositeOperation='source-over';
      // A single smooth exposure bloom, no strobing or repeated white flashes.
      var exposure=Math.sin(Math.PI*clamp(t/.22))*.13;
      if(t<.22){context.fillStyle='rgba(255,220,170,'+exposure+')';context.fillRect(0,0,width,height);}
      if(t===1)context.clearRect(0,0,width,height);
    }, 1);
  }
}());
