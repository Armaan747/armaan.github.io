# Dev-only. Turns lines.json (from drawing_lines.py) into the inline SVG block pasted into index.html as drawing.html.
import json
r=json.load(open('lines.json'))
def grp(name,v,ext=True):
    d=r[v]
    s=f'<g id="{name}"><path class="dr-out" d="{d["outline"]}"/>'
    if d['creases']: s+=f'<path class="dr-crease" d="{d["creases"]}"/>'
    if ext: s+=f'<path class="dr-ext" d="{d["tail_ext"]}"/>'
    return s+'</g>'
T,S,F=r['top'],r['side'],r['front']
tw,th=T['size']; sw,sh=S['size']; fw,fh=F['size']
defs=f'''<svg class="dr-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
{grp('uav-top','top')}
{grp('uav-side','side')}
{grp('uav-front','front',False)}
</defs></svg>'''
# wide layout
tx,ty=140,200
rx=2300
sy=ty+(th-1100)//2
fy=sy+sh+420
tail_x0=1335; tail_x1=1535   # retracted and extended trailing edge, local side-view coords
dimy=sy+sh+90
wide=f'''<svg class="dr dr-wide" viewBox="0 0 4300 {ty+th+230}" role="img" aria-label="Line drawing of the variable-stability UAV: top, side and front views. The telescoping tail is drawn retracted and, dashed, extended by 200 mm. Wingspan 1800 mm.">
<use href="#uav-top" x="{tx}" y="{ty}"/>
<line class="dr-center" x1="{tx+900}" y1="{ty-40}" x2="{tx+900}" y2="{ty+th+40}"/>
<line class="dr-dim" x1="{tx}" y1="110" x2="{tx+1800}" y2="110"/><line class="dr-dim" x1="{tx}" y1="80" x2="{tx}" y2="140"/><line class="dr-dim" x1="{tx+1800}" y1="80" x2="{tx+1800}" y2="140"/>
<text class="dr-txt" x="{tx+900}" y="86" text-anchor="middle">1800 mm</text>
<text class="dr-lbl" x="{tx}" y="{ty+th+130}">TOP</text>
<use href="#uav-side" x="{rx}" y="{sy}"/>
<line class="dr-dim" x1="{rx+tail_x0}" y1="{dimy}" x2="{rx+tail_x1}" y2="{dimy}"/><line class="dr-dim" x1="{rx+tail_x0}" y1="{dimy-25}" x2="{rx+tail_x0}" y2="{dimy+25}"/><line class="dr-dim" x1="{rx+tail_x1}" y1="{dimy-25}" x2="{rx+tail_x1}" y2="{dimy+25}"/>
<text class="dr-txt" x="{rx+tail_x1}" y="{dimy+80}" text-anchor="end">200 mm tail stroke</text>
<text class="dr-lbl" x="{rx}" y="{sy-50}">SIDE</text>
<use href="#uav-front" x="{rx}" y="{fy}"/>
<line class="dr-center" x1="{rx+900}" y1="{fy-40}" x2="{rx+900}" y2="{fy+fh+40}"/>
<text class="dr-lbl" x="{rx}" y="{fy+fh+110}">FRONT</text>
</svg>'''
narrow=f'''<svg class="dr dr-top" viewBox="0 0 2080 {th+420}" role="img" aria-label="Line drawing of the variable-stability UAV, top view. The telescoping tail is drawn retracted and, dashed, extended by 200 mm. Wingspan 1800 mm.">
<use href="#uav-top" x="140" y="200"/>
<line class="dr-center" x1="1040" y1="160" x2="1040" y2="{200+th+40}"/>
<line class="dr-dim" x1="140" y1="110" x2="1940" y2="110"/><line class="dr-dim" x1="140" y1="80" x2="140" y2="140"/><line class="dr-dim" x1="1940" y1="80" x2="1940" y2="140"/>
<text class="dr-txt" x="1040" y="86" text-anchor="middle">1800 mm</text>
<text class="dr-lbl" x="140" y="{200+th+120}">TOP</text>
</svg>'''
open('drawing.html','w',encoding='utf-8').write(defs+'\n'+wide+'\n'+narrow+'\n')
print(len(defs)+len(wide)+len(narrow),'chars; wide viewBox height',ty+th+230)
