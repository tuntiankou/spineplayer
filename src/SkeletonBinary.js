export class SkeletonBinary {
    constructor(scale) {
        this.data = null;
        this.scale =scale || 1;
        this.json = {
            skeleton: {},
            bones : [],
            slots :[],
            ik : [],
            transform : [],
            path : [],
            skins : {},
            skinsName :[],
            events : [],
            eventsName : [],
            animations : {},
            animationName : []
        };
        this.nextNum = 0;
        this.chars =null;
        this.version = null;
        this.nonessential = false;
    } 
    readByte() {
        return this.nextNum < this.data.length ? this.data[this.nextNum++] : null;
    }
    readBoolean() {
        return this.readByte() != 0;
    }
    readShort() {
        return (this.readByte() << 8) | this.readByte();
    }
    readSByte() {
        let b = this.readByte()
        return b>127? b-256 :b;
    }
    readInt(optimizePositive) {
        if(typeof optimizePositive === 'undefined'){
            return (this.readByte() << 24) | (this.readByte() << 16) | (this.readByte() << 8) | this.readByte();
        }
        let b = this.readByte();
        let result = b & 0x7f;
        if ((b & 0x80) != 0){
            b = this.readByte();
            result |= (b & 0x7F) << 7;
            if ((b & 0x80) != 0){
                b = this.readByte();
                result |= (b & 0x7F) << 14;
                if ((b & 0x80) != 0){
                    b = this.readByte();
                    result |= (b & 0x7F) << 21;
                    if ((b & 0x80) != 0){
                        b = this.readByte();
                        result |= (b & 0x7F) << 28;
                    }
                }
            }
        }
        return optimizePositive ? result : ((result >> 1) ^ -(result & 1));
    }
    bytes2Float32(bytes) {
        let sign = (bytes & 0x80000000) ? -1 : 1;
        let exponent = ((bytes >> 23) & 0xFF) - 127;
        let significand = (bytes & ~(-1 << 23));

        if (exponent == 128)
            return sign * ((significand) ? Number.NaN : Number.POSITIVE_INFINITY);

        if (exponent == -127) {
            if (significand == 0) return sign * 0.0;
            exponent = -126;
            significand /= (1 << 22);
        } else significand = (significand | (1 << 23)) / (1 << 23);

        return sign * significand * Math.pow(2, exponent);
    }
    readFloat () {
        return this.bytes2Float32((this.readByte()<<24) + (this.readByte()<<16) + (this.readByte()<<8) + (this.readByte()<<0));
    }
    readVertices(vertexCount) {
        let verticesLength = vertexCount << 1;
        if(!this.readBoolean()){
            return this.readFloatArray(verticesLength, this.scale);
        }

        let vertices = new Array();
        for(let i = 0; i < vertexCount; i++){
            let boneCount = this.readInt(true);
            vertices.push(boneCount);
            for(let j = 0; j < boneCount; j++){
                vertices.push(this.readInt(true));
                vertices.push(this.readFloat() * this.scale);
                vertices.push(this.readFloat() * this.scale);
                vertices.push(this.readFloat());
            }
        }
        return vertices;
    }
    readFloatArray(n, scale) {
        let array = new Array(n);
        if(scale == 1){
            for(let i = 0; i < n; i++){
                array[i] = this.readFloat();
            }
        }else{
            for(let i = 0; i < n; i++){
                array[i] = this.readFloat() * scale;
            }
        }
        return array;
    }
    readShortArray () {
        let n = this.readInt(true);
        let array = new Array(n);
        for(let i = 0; i < n; i++){
            array[i] = this.readShort();
        }
        return array;
    }
    readIntArray() {
        let n = this.readInt(true);
        let array = new Array(n);
        for(let i = 0; i < n; i++)
            array[i] = this.readInt(true);
        return array;
    }
    readHex() {
        let hex = this.readByte().toString(16);
        return hex.length == 2 ? hex : '0' + hex;
    }
    readColor() {
        return this.readHex() + this.readHex() + this.readHex() + this.readHex();
    }
    readString() {
        let charCount = this.readInt(true);
        switch(charCount){
            case 0:
                return null;
            case 1:
                return "";
            }
            charCount--;
            let chars = "";
            let b = 0;
            for(let i = 0; i < charCount;){
                b = this.readByte();
                switch (b >> 4){
                case 12:
                case 13:
                    chars += String.fromCharCode((b & 0x1F) << 6 | this.readByte() & 0x3F);
                    i += 2;
                    break;
                case 14:
                    chars += String.fromCharCode((b & 0x0F) << 12 | (this.readByte() & 0x3F) << 6 | this.readByte() & 0x3F);
                    i += 3;
                    break;
                default:
                    chars += String.fromCharCode(b);
                    i++;
                }
            }
        return chars;
    }
    readSkin(skinName, nonessential){
        let slotCount = this.readInt(true);
        if(slotCount == 0)
            return null;
        let skin = {};
        for(let i = 0; i < slotCount; i++){
            let slotIndex = this.readInt(true);
            let slot = {};
            for(let j = 0, n = this.readInt(true); j < n; j++){
                let name = this.readString();
                let attachment = this.readAttachment(name, nonessential);
                if(attachment != null){
                    slot[name] = attachment;
                }
            }
            skin[this.json.slots[slotIndex].name] = slot;
        }
        return skin;
    }

    readAttachment(attachmentName, nonessential){
        let scale = this.scale;
        let name = this.readString();
        if(name == null)
            name = attachmentName;
        let pathName
        let vertexCount
        let attachmentType =AttachmentType[this.readByte()]
        switch(attachmentType){
        case "region":
            pathName = this.readString();
            if(pathName == null)
                pathName = name;
            let region = {
                type: attachmentType,
                name: name,
                path: pathName.trim()
            };
            region.rotation = this.readFloat();
            region.x = this.readFloat() * scale;
            region.y = this.readFloat() * scale;
            region.scaleX = this.readFloat();
            region.scaleY = this.readFloat();
            region.width = this.readFloat() * scale;
            region.height = this.readFloat() * scale;
            region.color = this.readColor();
            return region;
        case "boundingbox":
            let box = {
                type: attachmentType,
                name: name       
            };

            vertexCount = this.readInt(true);
            box.vertexCount = vertexCount;
            box.worldVerticesLength = vertexCount << 1;
            box.vertices = this.readVertices(vertexCount).vertices;
            box.bones = vertices.bones; 
            if(this.nonessential){
                color = this.readColor();
            }   
            return box;
        case "mesh":
            pathName = this.readString();
            if(pathName == null)
                pathName = name;
            let mesh = {
                type: attachmentType,
                name: name,
                path: pathName
            };
            mesh.color = this.readColor();
            vertexCount = this.readInt(true);
            mesh.worldVerticesLength = vertexCount << 1;
            mesh.uvs = this.readFloatArray(vertexCount << 1, 1);
            mesh.triangles = this.readShortArray();
            mesh.vertices = this.readVertices(vertexCount);
            mesh.hull = this.readInt(true) << 1;
            if(this.nonessential){
                mesh.edges = this.readShortArray();
                mesh.width = this.readFloat() * scale;
                mesh.height = this.readFloat() * scale;
            }
            return mesh;
        case "linkedmesh":
            pathName = this.readString();
            if(pathName == null)
                pathName = name;
            let linkedmesh = {
                type: attachmentType,
                name: name,
                path: pathName
            };
            linkedmesh.color = this.readColor();
            linkedmesh.skin = this.readString();
            linkedmesh.parent = this.readString();
            linkedmesh.deform = this.readBoolean();
            if(this.nonessential){
                linkedmesh.width = this.readFloat() * scale;
                linkedmesh.height = this.readFloat() * scale;
            }
            return linkedmesh;
        case "path":
            let path = {
                type: attachmentType,
                name: name
            }; 
            path.closed = this.readBoolean();
            path.constantSpeed = this.readBoolean();
            vertexCount = this.readInt(true);
            path.vertexCount = vertexCount;
            path.vertices = this.readVertices(vertexCount);
            let lengths = new Array(vertexCount / 3);
            for(let i = 0; i < lengths.length; i++){
                lengths[i] = this.readFloat() * scale;
            }
            path.lengths = lengths;
            if(nonessential){
                path.color = this.readColor();
            }
            return path;
        case "point":
            let point = {
                type: attachmentType,
                name: name
            };
            point.rotation = this.readFloat();
            point.x = this.readFloat() * scale;
            point.y = this.readFloat() * scale;
            if(nonessential){
                path.color = this.readColor();
            }
            return point;
        case "clipping":
            let clipping = {
                type: attachmentType,
                name: name
            };
            clipping.end = this.readInt(true);
            vertexCount = this.readInt(true);
            clipping.vertexCount = vertexCount;
            clipping.vertices = this.readVertices(vertexCount);
            if(nonessential){
                clipping.color = this.readColor();
            }
            return clipping;
        }
        return null;
    }
    readCurve(frameIndex, timeline) {
        switch(this.readByte()){
        case 0: //CURVE_LINEAR
            timeline[frameIndex].curve = "linear";
            break;
        case 1: //CURVE_STEPPED
            timeline[frameIndex].curve = "stepped";
            break;
        case 2: //CURVE_BEZIER
            let cx1 = this.readFloat();
            let cy1 = this.readFloat();
            let cx2 = this.readFloat();
            let cy2 = this.readFloat();
            timeline[frameIndex].curve = [cx1, cy1, cx2, cy2];
        }
    }
    readAnimation(name) {
        let animation = {};
        let scale = this.scale;
        let duration = 0;

        // Slot timelines.
        let slots = {};
        for(let i = 0, n = this.readInt(true); i < n; i++){
            let slotIndex = this.readInt(true);
            let slotMap = {};
            let timeCount = this.readInt(true);
            for(let ii = 0; ii < timeCount; ii++){
                let timelineType = this.readByte();
                let frameCount = this.readInt(true);
                let timeline = new Array(frameCount);
                switch(timelineType){
                    case 0: //SLOT_ATTACHMENT
                    
                    for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let time = this.readFloat();
                        let attachmentName = this.readString();
                        timeline[frameIndex] = {};
                        timeline[frameIndex].time = time;
                        timeline[frameIndex].name = attachmentName;
                    }
                    slotMap.attachment = timeline;
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                    break;
                case 1: //SLOT_COLOR

                    for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let time = this.readFloat();
                        let color = this.readColor();
                        timeline[frameIndex] = {};
                        timeline[frameIndex].time = time;
                        timeline[frameIndex].color = color;
                        if(frameIndex < frameCount - 1){
                            let str = this.readCurve(frameIndex, timeline);
                        }
                    }
                    slotMap.color = timeline;
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                    break;
                case 2: //SLOT_TWO_COLOR

                    for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let time = this.readFloat();
                        let light = this.readColor();
                        let dark = this.readColor();
                        timeline[frameIndex] = {};
                        timeline[frameIndex].time = time;
                        timeline[frameIndex].light = light;
                        timeline[frameIndex].dark = dark;
                        if(frameIndex < frameCount - 1){
                            let str = this.readCurve(frameIndex, timeline);
                        }
                    }
                    slotMap.twoColor = timeline;
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                    break;
                }
            }
            slots[this.json.slots[slotIndex].name] = slotMap;
        }
        animation.slots = slots;

        // Bone timelines.
        let bones = {};
        for(let i = 0, n = this.readInt(true); i < n; i++){
            let boneIndex = this.readInt(true);
            let boneMap = {};
            for(let ii = 0, nn = this.readInt(true); ii < nn; ii++){
                let timelineType = this.readByte();
                let frameCount = this.readInt(true);
                let timeline = new Array(frameCount);
                switch(timelineType){
                case 0: //BONE_ROTATE

                    for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let time = this.readFloat();
                        let angle = this.readFloat();
                        timeline[frameIndex] = {};
                        timeline[frameIndex].time = time;
                        timeline[frameIndex].angle = angle;
                        if(frameIndex < frameCount - 1){
                            this.readCurve(frameIndex, timeline);
                        }
                    }
                    boneMap.rotate = timeline;
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                    break;
                case 1: //BONE_TRANSLATE
                case 2: //BONE_SCALE
                case 3: //BONE_SHEAR
                    let timelineScale = 1;
                    if(timelineType == 1){ //BONE_TRANSLATE
                        timelineScale = scale;
                    }
                    for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let tltime = this.readFloat();
                        let tlx = this.readFloat();
                        let tly = this.readFloat();
                        timeline[frameIndex] = {};
                        timeline[frameIndex].time = tltime;
                        timeline[frameIndex].x = tlx * timelineScale;
                        timeline[frameIndex].y = tly * timelineScale;
                        if(frameIndex < frameCount - 1){
                            this.readCurve(frameIndex, timeline);
                        }
                    }
                    if(timelineType == 1){
                        boneMap.translate = timeline;
                    }else if(timelineType == 2){
                        boneMap.scale = timeline;
                    }else{
                        boneMap.shear = timeline;
                    }
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                    break;
                }
            }
            bones[this.json.bones[boneIndex].name] = boneMap;
        }
        animation.bones = bones;

        // IK timelines.
        let ik = {};
        for(let i = 0, n = this.readInt(true); i < n; i++){
            let ikIndex = this.readInt(true);
            let frameCount = this.readInt(true);
            let timeline = new Array(frameCount);
            for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                let time = this.readFloat();
                let mix = this.readFloat();
                let bendPositive = this.readByte() != 255; // 1 = true, -1 (255) = false;
                timeline[frameIndex] = {};
                timeline[frameIndex].time = time;
                timeline[frameIndex].mix = mix;
                timeline[frameIndex].bendPositive = bendPositive;
                if(frameIndex < frameCount - 1){
                    this.readCurve(frameIndex, timeline);
                }
            }
            ik[this.json.ik[ikIndex].name] = timeline;
            duration = Math.max(duration, timeline[frameCount - 1].time);
        }
        animation.ik = ik;

        // Transform timelines.
        let transform = {};
        for(let i = 0, n = this.readInt(true); i < n; i++){
            let transformIndex = this.readInt(true);
            let frameCount = this.readInt(true);
            let timeline = new Array(frameCount);
            for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                timeline[frameIndex] = {};
                timeline[frameIndex].time = this.readFloat();
                timeline[frameIndex].rotateMix = this.readFloat();
                timeline[frameIndex].translateMix = this.readFloat();
                timeline[frameIndex].scaleMix = this.readFloat();
                timeline[frameIndex].shearMix = this.readFloat();
                if(frameIndex < frameCount - 1){
                    this.readCurve(frameIndex, timeline);
                }
            }
            transform[this.json.transform[transformIndex].name] = timeline;
            duration = Math.max(duration, timeline[frameCount - 1].time);
        }
        animation.transform = transform;

        // Path timelines.
        let paths = {}
        for(let i = 0, n = this.readInt(true); i < n; i++){
            let pathIndex = this.readInt(true);
            let pathConst = this.json.path[pathIndex];
            let pathMap ={};
            for(let ii = 0, nn = this.readInt(true); ii < nn; ii++){
                let timelineType = this.readByte();
                let frameCount = this.readInt(true);
                let timeline = new Array(frameCount);
                switch(timelineType){
                case 0: //PATH_POSITION
                case 1: //PATH_SPACING

                    let timelineScale = 1;
                    if(timelineType == 1){ //PATH_SPACING
                        if(pathConst.spacingMode == "length" || pathConst.spacingMode == "fixed"){
                            timelineScale = this.scale;
                        }
                    }else{ //PATH_POSITION
                        if(pathConst.positionMode == "fixed"){
                            timelineScale = this.scale;
                        }
                    }
                    for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let time = this.readFloat();
                        let f = this.readFloat();
                        timeline[frameIndex] = {}
                        timeline[frameIndex].time = time;
                        if(timelineType == 0){
                            timeline[frameIndex].position = f * timelineScale;
                        }else{
                            timeline[frameIndex].spacing = f * timelineScale;
                        }
                        if(frameIndex < frameCount - 1)
                            this.readCurve(frameIndex, timeline);
                    }
                    if(timelineType == 0){
                        pathMap.position = timeline;
                    }else{
                        pathMap.spacing = timeline;
                    }
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                    break;
                case 2: //PATH_MIX

                    for(let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let time = this.readFloat();
                        let rotateMix = this.readFloat();
                        let translateMix = this.readFloat();
                        timeline[frameIndex] = {}
                        timeline[frameIndex].time = time;
                        timeline[frameIndex].rotateMix = rotateMix;
                        timeline[frameIndex].translateMix = translateMix;
                        if(frameIndex < frameCount - 1)
                            this.readCurve(frameIndex, timeline);
                    }
                    pathMap.mix = timeline;
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                    break;
                }
            }
            paths[this.json.path[pathIndex].name] = pathMap;
        }
        animation.paths = paths;

        // Deform timelines.
        let deform = {};
        for(let i = 0, n = this.readInt(true); i < n; i++){
            let skinIndex = this.readInt(true);
            let skinName = this.json.skinsName[skinIndex];
            let skin = {};
            for(let ii = 0, nn = this.readInt(true); ii < nn; ii++){
                let slotIndex = this.readInt(true);
                let slotAtt = this.json.slots[slotIndex];
                let slot = {}
                for(let iii = 0, nnn = this.readInt(true); iii < nnn; iii++){
                    let meshName = this.readString();
                    let frameCount = this.readInt(true);
                    let timeline = new Array(frameCount);
                    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++){
                        let time = this.readFloat();
                        let end = this.readInt(true);
                        timeline[frameIndex] = {};
                        timeline[frameIndex].time = time;
                        if(end != 0){
                            let vertices = new Array(end);
                            let start = this.readInt(true);
                            if (this.scale == 1){
                                for (let v = 0; v < end; v++){
                                    vertices[v] = this.readFloat();
                                }
                            }else{
                                for (let v = 0; v < end; v++){
                                    vertices[v] = this.readFloat() * this.scale;
                                }
                            }
                            timeline[frameIndex].offset = start;
                            timeline[frameIndex].vertices = vertices;
                        }
                        if(frameIndex < frameCount - 1)
                            this.readCurve(frameIndex, timeline);
                    }
                    slot[meshName] = timeline;
                    duration = Math.max(duration, timeline[frameCount - 1].time);
                }
                skin[slotAtt.name] = slot;
            }
            deform[skinName] = skin;
        }
        animation.deform = deform;

        // Draw order timeline.
        let drawOrderCount = this.readInt(true);
        if(drawOrderCount > 0){
            let drawOrders = new Array(drawOrderCount);
            // let timeline = new Array(drawOrderCount);
            // let slotCount = this.json.slots.length;
            for(let i = 0; i < drawOrderCount; i++){
                let drawOrderMap = {};
                let time = this.readFloat();
                let offsetCount = this.readInt(true);
                // let drawOrder = new Array(slotCount);
                // for(let ii = slotCount - 1; ii >= 0; ii--){
                //     drawOrder[ii] = -1;
                // }
                // let unchanged = new Array(slotCount - offsetCount);
                // let originalIndex = 0, unchangedIndex = 0;
                let offsets = new Array(offsetCount);
                for(let ii = 0; ii < offsetCount; ii++){
                    let offsetMap = {};
                    let slotIndex = this.readInt(true);
                    offsetMap.slot = this.json.slots[slotIndex].name;
                    // while (originalIndex != slotIndex)
                    //     unchanged[unchangedIndex++] = originalIndex++;
                    let dooffset = this.readInt(true);
                    offsetMap.offset = dooffset;
                    // drawOrder[originalIndex + dooffset] = originalIndex++;
                    offsets[ii] = offsetMap;
                }
                drawOrderMap.offsets = offsets;

                // while(originalIndex < slotCount)
                //     unchanged[unchangedIndex++] = originalIndex++;
                // for (let ii = slotCount - 1; ii >= 0; ii--){
                //     if (drawOrder[ii] == -1)
                //         drawOrder[ii] = unchanged[--unchangedIndex];
                // }
                // let tltime = this.readFloat();
                drawOrderMap.time = time;
                drawOrders[i] = drawOrderMap;
            }
            duration = Math.max(duration, drawOrders[drawOrderCount - 1].time);
            animation.drawOrder = drawOrders;
        }

        // Event timeline.
        let eventCount = this.readInt(true);
        if(eventCount > 0){
            let events = new Array(eventCount);
            for(let i = 0; i < eventCount; i++){
                let time = this.readFloat();
                let name = this.json.eventsName[this.readInt(true)];
                let eventData = this.json.events[name];
                let e = {};
                e.name = name;
                e.int = this.readInt(false);
                e.float = this.readFloat();
                e.string = this.readBoolean() ? this.readString() : eventData.string;
                e.time = time;
                events[i] = e;
            }
            duration = Math.max(duration, events[eventCount - 1].time);
            animation.events = events;
        }
        return animation;
    }
    readSkeleton() {
        let skeleton = {}
        skeleton.hash = this.readString();
   
        if(skeleton.hash.length == 0)
            skeleton.hash = null;
        skeleton.spine = this.readString();
        if(skeleton.spine.length == 0)
            skeleton.spine = null;
        if(skeleton.spine.startsWith("3.3")) {
            this.flag33 = true;
        }
        skeleton.width = this.readFloat();
        skeleton.height = this.readFloat();

        let nonessential = this.readBoolean();
        console.log(nonessential, "nonessential")
        this.nonessential = nonessential
        if (nonessential) {
            skeleton.fps =  this.flag33? 60 : this.readFloat();
            skeleton.images= this.readString();
            if (skeleton.images.Length == 0) skeleton.images = null;
        }
        this.json.skeleton = skeleton
        console.log("skeleton", skeleton)
    }
    initJson() {

        this.readSkeleton();
        if (this.flag33) {
            this.json.skins = {"AA":""};
            this.json.skinsName =["AA"];
            this.json.animations = {"AA":""}
            this.json.animationName = ["AA"]
        }
        let nonessential = this.nonessential

        //Bones.
        let n =  this.readInt(true)
        console.log("Get bones ", n)
        let bones = new Array(n);
        for (let i = 0; i < n; i++) {
  
            let boneData = {};
            boneData.name = this.readString();     
            let parent = null
            
            if (i!=0) {     
                parent = bones[this.readInt(true)]
                boneData.parent = parent && parent.name;  
            }      
            boneData.rotation = this.readFloat();       
            boneData.x = this.readFloat() * this.scale;
            boneData.y = this.readFloat() * this.scale;
            boneData.scaleX = this.readFloat();
            boneData.scaleY = this.readFloat();
            boneData.shearX = this.readFloat();
            boneData.shearY = this.readFloat();
            boneData.length = this.readFloat() * this.scale;
            if (this.flag33) {
                let inheritScale = this.readBoolean()
                let inheritRotation = this.readBoolean()
                switch((inheritScale<<1) + inheritRotation){
                    case 0:
                        boneData.transform = TransformMode[1]
                    case 2:
                        boneData.transform = TransformMode[2]
                    case 1:
                        boneData.transform = TransformMode[3]
                    case 3:
                        boneData.transform = TransformMode[0]
                }                    
            } else {
                boneData.transform = TransformMode[this.readInt(true)];
            }         
            if (this.nonessential) {
                this.readColor(); //NOT USE BONE COLOR
            }
            bones[i] = boneData;  
        };
        this.json.bones = bones

        // Slots.
        n = this.readInt(true)
        console.log("Get slot ", n)
        let slots = new Array(n);
        for(let i = 0; i < n; i++){
            let slotData = {};
            slotData.name = this.readString();
            let boneData = this.json.bones[this.readInt(true)];
            slotData.bone = boneData.name;
            slotData.color = this.readColor();
            if(!this.flag33) {
                slotData.dark = this.readColor();
            }
            slotData.attachment = this.readString() || slotData.name;
            slotData.blend = BlendMode[this.readInt(true)];
            slots[i] = slotData;
        }
        this.json.slots = slots 

        console.log(slots,(this.nextNum*16).toString(16))
        // IK constraints.
        n = this.readInt(true)
        console.log("Get ik ", n)
        let ik = new Array(n);  
        for(let i = 0; i < n; i++){
            let ikConstraints = {};
            ikConstraints.name = this.readString();
            ikConstraints.order = this.flag33 ? 0 :this.readInt(true);
            ikConstraints.bones = new Array(this.readInt(true));
            for(let j = 0; j < ikConstraints.bones.length; j++){
                ikConstraints.bones[j] = this.json.bones[this.readInt(true)].name;
            }
            ikConstraints.target = this.json.bones[this.readInt(true)].name;
            ikConstraints.mix = this.readFloat();
            ikConstraints.bendPositive = this.readByte() != 255; // 1 = true, -1 (255) = false
            ik[i] = ikConstraints;
        }
        this.json.ik = ik

        // Transform constraints.
        n = this.readInt(true)
        console.log("Get transform ", n)
        let transform = new Array(n);  
        for(let i = 0; i < n; i++){
            let data = {
                name : this.readString()
            }
            data.order = this.flag33 ? 0 :this.readInt(true);
            data.bones = new Array(this.readInt(true));
            for (let ii = 0; ii < data.bones.length; ii++)
                data.bones[ii] = this.json.bones[this.readInt(true)].name;
            data.target = this.json.bones[this.readInt(true)].name;
            if(!this.flag33) {                
                data.local = this.readBoolean();
                data.relative = this.readBoolean();
            }
            data.rotation = this.readFloat();
            data.x = this.readFloat() * scale;
            data.y = this.readFloat() * scale;
            data.scaleX =  this.readFloat();
            data.scaleY =  this.readFloat();
            data.shearY =  this.readFloat();  
            data.rotateMix =  this.readFloat(input);
            data.translateMix =  this.readFloat();
            data.scaleMix =  this.readFloat();
            data.shearMix =  this.readFloat();
            transform[i] = data  
        }
        this.json.transform = transform

        // Path constraints.
        n = this.readInt(true)
        console.log("Get path ", n)
        let path = new Array(n);  
        for(let i = 0; i < n; i++){
            let data = {
                name : this.readString()
            }

            data.order = this.flag33 ? 0 :this.readInt(true);

            data.bones = new Array(this.readInt(true));
            for (let ii = 0; ii < data.bones.length; ii++)
                data.bones[ii] = this.json.bones[this.readInt(true)].name;

            data.target = this.json.bones[this.readInt(true)].name;

            data.positionMode = PositionMode[this.readInt(true)];
            data.spacingMode = SpacingMode[this.readInt(true)];
            data.rotateMode = RotateMode[this.readInt(true)];
            data.rotation = this.readFloat();
            data.position = this.readFloat();
            if (data.positionMode == "fixed") data.position *= this.scale;
            data.spacing = this.readFloat();
            if (data.spacingMode == "length" || data.spacingMode == "fixed") data.spacing *= this.scale;
            data.rotateMix = this.readFloat();
            data.translateMix = this.readFloat();
            path[i]= data
        }
        this.json.path = path


        // Default skin.
        this.json.skins = {};
        this.json.skinsName = new Array();
        let skins = this.json.skins;
        let defaultSkin = this.readSkin("default", nonessential);
        if(defaultSkin != null){
            skins["default"] = defaultSkin;
            this.json.skinsName.push("default");
        }


        n = this.readInt(true)
        console.log("read skins ", n)
        // Skin.
        for(let i = 0; i < n; i++){
            let skinName = this.readString();
            let skin = this.readSkin(skinName, nonessential);
            skins[skinName] = skin;
            this.json.skinsName.push(skinName);
        }

        this.json.skins = skins

        // Events.
        n = this.readInt(true)
        console.log("get Event ", n)

        for(let i = 0; i < n; i++){
            let eventName = this.readString();
            let eventData = {};
            eventData.int = this.readInt(false);
            eventData.float = this.readFloat();
            eventData.string = this.readString();
            this.json.events[eventName] = eventData;
            this.json.eventsName.push(eventName);
        }

        // Animations.
        let animations = {};
        n = this.readInt(true)
        console.log("get Animations ", n)

        for(let i = 0; i < n; i++){
            let animationName = this.readString();
            let animation = this.readAnimation(animationName);
            animations[animationName] = animation;
        }
        this.json.animations = animations;

        console.log(animations)

    }
}
let BlendMode = ["normal", "additive", "multiply", "screen"];

let AttachmentType = ["region", "boundingbox", "mesh", "linkedmesh", "path", "point", "clipping"];

let TransformMode = ["normal", "onlyTranslation", "noRotationOrReflection", "noScale", "noScaleOrReflection"];

let PositionMode = ["fixed", "percent"];

let SpacingMode = ["length", "fixed", "percent"];

let RotateMode = ["tangent", "chain", "chainScale"];