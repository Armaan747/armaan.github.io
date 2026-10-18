# Dev-only. Builds the home-page line drawing from the STLs. Not used by the site at runtime.
# Needs numpy and shapely in a throwaway venv. Run from the repo root: python tools/drawing_lines.py && python tools/drawing_build.py
import numpy as np, json
from collections import defaultdict
from shapely.geometry import Polygon
from shapely.ops import unary_union
R="models/"
def load(p):
    d=open(p,'rb').read(); n=int(np.frombuffer(d,dtype='<u4',count=1,offset=80)[0])
    a=np.frombuffer(d,dtype=np.dtype([('n','<3f4'),('v','<9f4'),('a','<u2')]),count=n,offset=84)
    return a['v'].reshape(-1,3,3).astype(float)
fixed=load(R+'uav_fixed.stl'); tail=load(R+'uav_tail.stl')
ALL=np.concatenate([fixed,tail])
PX=1.5   # mm per raster pixel

def to2(P,view):   # P: (...,3) -> (a,b,depth); screen y is down
    X,Y,Z=P[...,0],P[...,1],P[...,2]
    if view=='top':   return -X,-Z,Y
    if view=='side':  return -Z,-Y,X
    return X,-Y,Z                      # front

def zbuffer(tris,view,bounds):
    a,b,d=to2(tris,view)
    x0,y0,x1,y1=bounds
    W=int((x1-x0)/PX)+3; H=int((y1-y0)/PX)+3
    zb=np.full((H,W),-1e9)
    for i in range(len(tris)):
        ax,ay,az=(a[i]-x0)/PX,(b[i]-y0)/PX,d[i]
        mnx,mxx=int(np.floor(ax.min())),int(np.ceil(ax.max())); mny,mxy=int(np.floor(ay.min())),int(np.ceil(ay.max()))
        if mxx<mnx or mxy<mny: continue
        gx,gy=np.meshgrid(np.arange(mnx,mxx+1),np.arange(mny,mxy+1))
        den=(ay[1]-ay[2])*(ax[0]-ax[2])+(ax[2]-ax[1])*(ay[0]-ay[2])
        if abs(den)<1e-9: continue
        l1=((ay[1]-ay[2])*(gx-ax[2])+(ax[2]-ax[1])*(gy-ay[2]))/den
        l2=((ay[2]-ay[0])*(gx-ax[2])+(ax[0]-ax[2])*(gy-ay[2]))/den
        l3=1-l1-l2
        m=(l1>=-0.02)&(l2>=-0.02)&(l3>=-0.02)
        z=l1*az[0]+l2*az[1]+l3*az[2]
        yy,xx=gy[m],gx[m]; zz=z[m]
        ok=(yy>=0)&(yy<H)&(xx>=0)&(xx<W)
        yy,xx,zz=yy[ok],xx[ok],zz[ok]
        cur=zb[yy,xx]; upd=zz>cur; zb[yy[upd],xx[upd]]=zz[upd]
    return zb

def crease_edges(tris,ang=35):
    key=lambda p:tuple(np.round(p,2))
    n=np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0]); ln=np.linalg.norm(n,axis=1); ln[ln==0]=1; n=n/ln[:,None]
    ed=defaultdict(list)
    for i,t in enumerate(tris):
        for j in range(3):
            p,q=key(t[j]),key(t[(j+1)%3]); ed[(p,q) if p<q else (q,p)].append(i)
    out=[]; c=np.cos(np.radians(ang))
    for (p,q),fs in ed.items():
        if len(fs)==1 or (len(fs)==2 and np.dot(n[fs[0]],n[fs[1]])<c): out.append((p,q))
    return np.array(out,dtype=float)   # (E,2,3)

def sil(tris,view,dz=0,tol=1.2):
    t=tris.copy(); t[:,:,2]+=dz; a,b,_=to2(t,view); polys=[]
    for i in range(len(t)):
        pg=Polygon(np.stack([a[i],b[i]],1))
        if pg.area>1e-6: polys.append(pg.buffer(0.3))
    return unary_union(polys).buffer(-0.3).simplify(tol)

def rings(g):
    gs=[g] if g.geom_type=='Polygon' else list(g.geoms)
    for p in gs:
        yield list(p.exterior.coords)
        for h in p.interiors: yield list(h.coords)

def path(ring_list,ox,oy):
    return ' '.join('M'+' L'.join(f'{x-ox:.0f} {y-oy:.0f}' for x,y in r)+'Z' for r in ring_list)

edges=crease_edges(ALL)
print('crease edges',len(edges))
res={}
for view in ('top','side','front'):
    s_all=sil(ALL,view); s_te=sil(tail,view,dz=-200)
    x0,y0,x1,y1=unary_union([s_all,s_te]).bounds
    bounds=(x0-10,y0-10,x1+10,y1+10)
    zb=zbuffer(ALL,view,bounds)
    # visible crease segments, sampled every ~PX
    a,b,d=to2(edges,view)
    segs=[]
    for e in range(len(edges)):
        L=np.hypot(a[e,1]-a[e,0],b[e,1]-b[e,0]); n=max(2,int(L/PX)+1); t=np.linspace(0,1,n)
        xs=a[e,0]+(a[e,1]-a[e,0])*t; ys=b[e,0]+(b[e,1]-b[e,0])*t; ds=d[e,0]+(d[e,1]-d[e,0])*t
        ix=np.clip(((xs-bounds[0])/PX).astype(int),0,zb.shape[1]-1); iy=np.clip(((ys-bounds[1])/PX).astype(int),0,zb.shape[0]-1)
        vis=ds>=zb[iy,ix]-3.0
        s=None
        for k in range(n):
            if vis[k] and s is None: s=k
            if (not vis[k] or k==n-1) and s is not None:
                e_=k if vis[k] else k-1
                if e_>s and np.hypot(xs[e_]-xs[s],ys[e_]-ys[s])>6: segs.append((xs[s],ys[s],xs[e_],ys[e_]))
                s=None
    ox,oy=x0,y0
    res[view]={'size':[round(x1-x0),round(y1-y0)],
      'outline':path(rings(s_all),ox,oy),'tail_ext':path(rings(s_te),ox,oy),
      'creases':' '.join(f'M{a_-ox:.0f} {b_-oy:.0f}L{c_-ox:.0f} {d_-oy:.0f}' for a_,b_,c_,d_ in segs),
      'nsegs':len(segs),'bbox':[x0,y0,x1,y1]}
    print(view,res[view]['size'],'segs',len(segs),'outline chars',len(res[view]['outline']),'crease chars',len(res[view]['creases']))
json.dump(res,open('lines.json','w'))
