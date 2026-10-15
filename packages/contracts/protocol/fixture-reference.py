import json,struct,base64,math,copy,pathlib
s=json.load(open('packages/contracts/protocol/schema.json'));T=s['types'];M=s['messages'];defs=json.load(open('packages/contracts/configuration/defaults.json'))
def zero(type):
 return {f['name']:([zero(f['type']) for _ in range(f['array'])] if f.get('fixed') else []) if 'array' in f else zero(f['type']) if f['type'] in T else '' if f['type'] in ['string','bytes'] else 0 for f in T[type]}
def encode(type,v,projection=False):
 out=b''
 fields=T[type];index=0
 while index<len(fields):
  f=fields[index];index+=1
  if 'bits' in f:
   packed=0;shift=0;index-=1
   while index<len(fields) and 'bits' in fields[index] and shift+fields[index]['bits']<=8:
    part=fields[index];packed|=v[part['name']]<<shift;shift+=part['bits'];index+=1
   out+=bytes([packed]);continue
  def scalar(x):
   t=f['type']
   if t in T:return encode(t,x,projection)
   if t in ['bytes','string']:
    b=base64.b64decode(x) if t=='bytes' else x.encode();return struct.pack('>I',len(b))+b
   if t=='f64' and f.get('projection') and projection:return struct.pack('>q',math.floor(x*1024+.5))
   return struct.pack('>'+{'u8':'B','u16':'H','u32':'I','us':'Q','f64':'d'}[t],x)
  x=v[f['name']]
  out+= (b'' if f.get('fixed') else struct.pack('>I',len(x)))+b''.join(scalar(y) for y in x) if 'array' in f else scalar(x)
 return out
identity=dict(roomId=0x01020304,seatSession=5,pairGeneration=6,seat=0);round=dict(roundId=7,inputGeneration=8);progress=dict(authority=11,event=9,processed1=5,processed2=4,disposed1=5,disposed2=3)
context=zero('Context');context.update(configurationVersion=1,configurationId=0x11223344,generationVersion=1,seed=1,mode=1,startUs=3000000)
for group in ['gameplay','presentation','room','connection','operational']:
 source=defs[group]['drag-race'] if group=='gameplay' else defs[group];context[group].update(source)
car1=zero('Car');car1.update(progress=100.125,lateral=-40.25,normalSpeed=400,lane=0,departure=0,target=1,phase=1,controls=3,effective=3,flags=1,heldMask=4,movementOrigin=-120,movementTarget=0,movementStartUs=950000,movementEndUs=1100000,nextShiftUs=1100000,freshnessUs=2000000,hp=2,score=10,lastInput=5,inputGeneration=8)
car2=zero('Car');car2.update(progress=20000.5,lateral=60,normalSpeed=400,lane=2,departure=2,target=1,phase=2,movementOrigin=40,movementTarget=120,movementStartUs=980000,movementEndUs=1130000,nextShiftUs=1130000,hp=3,lastInput=4,inputGeneration=9)
contact=zero('Contact');contact.update(episode=3,flags=0,latestSeat=1,latestControl=3,latestSequence=5,latestTimeUs=950000,latestOrder=11)
baseline=zero('Baseline');baseline.update(identity=identity,round=round,epoch=0x1234,tick=60,timeUs=1000000,progress=progress,context=context,cars=[car1,car2],contact=contact)
baseline['generator'].update(randomState=0x8ef917d1,nextSlice=60,nextObject=10,cursor=21600,reservedCursor=4)
baseline['windows']=[dict(start=-100,end=1500,firstSlice=1,lastSlice=5,objects=[dict(id=1,sliceId=1,lane=0,flags=10,distance=400),dict(id=2,sliceId=2,lane=1,flags=5,distance=800)]),dict(start=19800,end=21400,firstSlice=49,lastSlice=55,objects=[dict(id=3,sliceId=51,lane=2,flags=3,distance=20400)])]
projection={k:baseline[k] for k in ['round','tick','timeUs','progress','cars','contact','generator','windows']};projection.update(configurationId=context['configurationId'],generationVersion=1,seed=1)
fixtures=[]
for name in M:
 v=zero(name)
 for k,x in dict(identity=identity,round=round,progress=progress,context=context,version=1,epoch=0x1234,tick=60,timeUs=1000000,sequence=5,authority=11,cars=[car1,car2],contact=contact).items():
  if k in v:v[k]=copy.deepcopy(x)
 if name=='AdmissionRequest':v.update(operation=1,code='0123',name='雪',credential='')
 if name=='Admission':v.update(credential=base64.b64encode(bytes(range(32))).decode(),roomTicket=base64.b64encode(b'room').decode(),gameplayTicket=base64.b64encode(b'game').decode(),expiresUs=30000000,origin='https://game.example')
 if name=='ProtocolError':v.update(code=1,expectedVersion=1,detail='incompatible version')
 if name=='RoomState':v.update(revision=4,mode=1,phase=1,host=0,roundId=7,startUs=3000000,idleWarningUs=840000000,idleExpiryUs=900000000,seats=[dict(session=5,name='P1',flags=7,reservationUs=0),dict(session=9,name='P2',flags=3,reservationUs=15000000)])
 if name=='RoomCommand':v.update(command=1,mode=1,ready=1)
 if name=='Handshake':v['datagramBytes']=10
 if name=='ClockRequest':v['clientSendUs']=9007199254740991
 if name=='ClockReply':v.update(clientSendUs=1000000,serverReceiveUs=1000100,serverSendUs=1000200)
 if name=='Ready':v['transferId']=1
 if name=='Outcome':v.update(roundId=7,outcomeId=12,result=0,reason=0,cars=[{k:c[k] for k in ['progress','lateral','hp','score']} for c in [car1,car2]])
 if name=='Input':v.update(intent=0,control=3,heldMask=4)
 if name=='Disposition':v.update(seat=0,sequence=5,processed=5,disposition=0,intent=0,control=3,car=car1)
 if name=='Coverage':v.update(authority=11,generator=baseline['generator'],windows=baseline['windows'])
 if name=='Event':v.update(eventId=9,kind=0,causeInput=5,objectId=1,episodeId=3,seatMask=1,objects=baseline['windows'][0]['objects'])
 if name=='BaselineChunk':v.update(transferId=1,total=len(encode('Baseline',baseline)),offset=0,index=0,count=1,data=base64.b64encode(encode('Baseline',baseline)).decode())
 body=bytes([M[name]['id']])+encode(name,v);b=struct.pack('>I',len(body))+body
 fixtures.append(dict(name=name,type=name,value=v,hex=b.hex()))
fixtures.append(dict(name='complete-continuation',type='Baseline',value=baseline,hex=encode('Baseline',baseline).hex()))
fixtures.append(dict(name='ten-byte-datagram',type='Verification',value=dict(epoch=0x1234,tick=0x01020304,crc=0x89abcdef),hex='12340102030489abcdef'))
def crc(b):
 c=0xffffffff
 for n in b:
  c^=n
  for i in range(8):c=(c>>1)^(0x82f63b78 if c&1 else 0)
 return c^0xffffffff
pb=encode('Projection',projection,True)
malformed=[dict(name='short-prefix',hex='0000'),dict(name='oversized-body',hex='ffffffff'),dict(name='empty-body',hex='00000000'),dict(name='unknown-type',hex='00000001ff')]
inputf=next(f for f in fixtures if f['type']=='Input');b=bytearray.fromhex(inputf['hex']);b[-2]=4;malformed.append(dict(name='invalid-control-enum',hex=b.hex()));malformed.append(dict(name='truncated-input',hex=inputf['hex'][:-2]))
for type,name,edit in [('Handshake','version-mismatch',lambda v:v.update(version=2)),('Disposition','ignored-press',lambda v:v.update(disposition=1)),('Disposition','rejected-press',lambda v:v.update(disposition=2)),('Input','freshness-refresh',lambda v:v.update(intent=2)),('Input','release',lambda v:v.update(intent=1))]:
 v=copy.deepcopy(next(f for f in fixtures if f['type']==type)['value']);edit(v);body=bytes([M[type]['id']])+encode(type,v);fixtures.append(dict(name=name,type=type,value=v,hex=(struct.pack('>I',len(body))+body).hex()))
# Concrete invalid records deliberately have valid frame length, so each rule is reached.
for name,type,path,value in [('nonfinite-position','Car',['progress'],float('inf')),('unsafe-microseconds','ClockRequest',['clientSendUs'],9007199254740992)]:
 v=copy.deepcopy(car1 if type=='Car' else next(f for f in fixtures if f['type']==type)['value']);v[path[0]]=value
 malformed.append(dict(name=name,type=type,hex=encode(type,v).hex()))
malformed.append(dict(name='reserved-object-packed-bit',type='ObjectState',hex='0000000100000001820000000000000000'))
malformed.append(dict(name='invalid-UTF8',type='ProtocolError',hex='01000100000001ff'))
malformed.append(dict(name='oversized-section',type='ProtocolError',hex='010001ffffffff'))
malformed.append(dict(name='oversized-window-count',type='Window',hex=(struct.pack('>ddIII',0,100,1,2,40001)).hex()))
json.dump(dict(version=1,schemaVersion=1,configurationVersion=1,seed=1,requirements=['https://github.com/shivang991/DashDevil2D/issues/14#issuecomment-6142660562','https://github.com/shivang991/DashDevil2D/issues/16#issuecomment-6171130505'],records=fixtures,malformed=malformed,quantization=[dict(value=0,expected=0),dict(value=-0.0,expected=0),dict(value=-.00048828125,expected=0),dict(value=.00048828125,expected=1),dict(value=-1.00048828125,expected=-1024),dict(value=1.00048828125,expected=1025)],crc=[dict(hex='',expected=0),dict(hex='616263',expected=0x364b3fb7)],projection=dict(hex=pb.hex(),crc=crc(pb))),open('packages/contracts/protocol/fixtures.json','w'),indent=2,ensure_ascii=False)
pathlib.Path('packages/contracts/protocol/fixtures.json').open('a').write('\n')
# Resource expectations use Python struct packing, not either production codec.
result=json.load(open('packages/contracts/protocol/fixtures.json'));resources=[]
for name,mode,overrides in [('drag-defaults','drag-race',{}),('rage-defaults','road-rage',{}),('dense-random-hearts','road-rage',dict(sliceSpacing=1,heartWeight=1,obstacleWeight=0)),('fast-wide-cars','drag-race',dict(maxRoadSpeed=10000,laneShiftDuration=.3,laneReturnDuration=.4))]:
 ctx=copy.deepcopy(context);ctx['mode']=['long-drive','drag-race','road-rage'].index(mode);ctx['gameplay']=zero('Gameplay');ctx['gameplay'].update(defs['gameplay'][mode]);ctx['gameplay'].update(overrides);g=ctx['gameplay'];c=ctx['connection']
 window=g['maxRoadSpeed']*g['accelSpeedMultiplier']+(g['carHeight']+max(g['obstacleH'],g['coinSize'],g['heartSize']))+g['sliceSpacing'];random=math.ceil(window/g['sliceSpacing'])+2;reserved=g.get('reservedHearts',0) if mode=='drag-race' else 0
 b=copy.deepcopy(baseline);b['context']=ctx;b['windows']=[dict(start=0,end=window,firstSlice=1,lastSlice=count,objects=[dict(id=i+1,sliceId=i+1,lane=i%3,flags=2,distance=i*g['sliceSpacing']) for i in range(count)]) for count in [random+reserved,random]]
 size=len(encode('Baseline',b));chunk=zero('BaselineChunk');header=len(encode('BaselineChunk',chunk))+5;payload=min(c['reliableFrameBytes'],c['queueBytes'],1048576)-header
 coverage=zero('Coverage');coverage['windows']=b['windows'];coverageBytes=len(encode('Coverage',coverage))+5
 resources.append(dict(name=name,mode=mode,overrides=overrides,context=ctx,expected=dict(objects=2*random+reserved,baselineBytes=size,chunkBytes=header+min(size,payload),chunks=math.ceil(size/payload),windowLength=window,maxProgress=g['finishDistance'] if mode=='drag-race' else g['maxRoadSpeed']*g['accelSpeedMultiplier']*g['timeLimit']),coverageBytes=coverageBytes))
result['resources']=resources
json.dump(result,open('packages/contracts/protocol/fixtures.json','w'),indent=2,ensure_ascii=False);pathlib.Path('packages/contracts/protocol/fixtures.json').open('a').write('\n')
result=json.load(open('packages/contracts/protocol/fixtures.json'))
for name,text in [('leading-BOM','\ufeffname'),('BOM-only','\ufeff')]:
 v=dict(code=1,expectedVersion=1,detail=text);body=bytes([M['ProtocolError']['id']])+encode('ProtocolError',v)
 result['records'].append(dict(name=name,type='ProtocolError',value=v,hex=(struct.pack('>I',len(body))+body).hex()))
result['semanticInvalid']=[]
for name,seat,changes in [('shift-target-outside-world',0,dict(movementTarget=1000000000)),('shift-origin-outside-world',0,dict(movementOrigin=-1000000000)),('shift-destination-disagrees-with-lane',0,dict(movementTarget=120)),('return-destination-disagrees-with-departure',1,dict(movementTarget=0))]:
 b=copy.deepcopy(baseline);b['cars'][seat].update(changes);result['semanticInvalid'].append(dict(name=name,value=b))
json.dump(result,open('packages/contracts/protocol/fixtures.json','w'),indent=2,ensure_ascii=False);pathlib.Path('packages/contracts/protocol/fixtures.json').open('a').write('\n')
