<template>
    <div id="app">
        <el-container>
            <el-container>
                <el-aside :width="'150px'">
                    <el-menu @select="menuSelect" default-active="aqua0">
                        <template v-for="item in items">
                            <el-menu-item :index="item.index">{{item.title}}</el-menu-item>
                        </template>
                    </el-menu>
                </el-aside>
                <el-container v-loading="loading">
                    <el-header :height="'140px'">
                        <el-form :inline="true">
                            <el-form-item label="循环播放">
                                <el-switch
                                        v-model="loop">
                                </el-switch>
                            </el-form-item>
                            <el-form-item label="皮肤">
                                <el-select v-model="skin" placeholder="请选择" style="width:120px;">
                                    <el-option
                                            v-for="skin_option in skin_options"
                                            :key="skin_option"
                                            :label="skin_option"
                                            :value="skin_option">
                                    </el-option>
                                </el-select>
                            </el-form-item>
                            <el-form-item label="动画">
                                <el-select v-model="anime" placeholder="请选择" style="width:120px;">
                                    <el-option
                                            v-for="anime_option in anime_options"
                                            :key="anime_option"
                                            :label="anime_option"
                                            :value="anime_option">
                                    </el-option>
                                </el-select>
                            </el-form-item>
                            <el-form-item label="背景颜色">
                                <el-color-picker v-model="color"></el-color-picker>
                            </el-form-item>
                            <br/>
                            <el-form-item label="慢放">
                                <el-slider v-model="timeScale" style="width: 500px" :max="10" :min="1"></el-slider>
                            </el-form-item>
                        </el-form>
                    </el-header>
                    <el-main>
                        <canvas ref="spine" :style="{backgroundColor:color}"></canvas>
                    </el-main>
                </el-container>
            </el-container>
            <el-footer :height="'40px'">
                <div style="font-size: 13px">网站所涉及的公司名称、商标、产品等均为其各自所有者的资产，仅供识别。<br/>
                                    </div>
            </el-footer>
        </el-container>
    </div>
</template>

<script>
    import {SkeletonBinary} from "./SkeletonBinary";
    export default {
        name: 'app',
        data() {
            return {
                items: [
                    {title:"Chris Cat", index:"Chris"},
                    {title:"Chris o", index:"C0"},
                    {title:"Alice", index:"Alice"},
                    {title:"lambda", index:"lambda"},
                    {title:"Renne", index:"renne"},
                ],
                loop: true,
                selected: "aqua0",
                skin: "",
                anime: "",
                skin_options: [],
                anime_options: [],
                color: "#FFFFFF",
                timeScale: 1,
                loading: true
            }
        },
        watch: {
            skin: function (n) {
                this.reloadSpine(this.selected, n);
            },
            anime: function (n) {
                this.PIXIApp.spine.state.setAnimation(0, n, this.loop);
            },
            loop: function (n) {
                if (this.anime) {
                    if (n) {
                        this.PIXIApp.spine.state.addAnimation(0, this.anime, this.loop);
                    } else {
                        this.PIXIApp.spine.state.addEmptyAnimation(0, 0, 0);
                    }
                }
            },
            timeScale: function (n) {
                this.PIXIApp.spine.state.timeScale = 1 / n;
            }
        },
        methods: {
            menuSelect: function (key) {
                if (this.selected !== key) {
                    this.selected = key;
                    this.loadData(key);
                }
            },
            loadData: function (selected) {
                if (!this.PIXIApp.loader.res[selected]) {
                    this.loading = true;
                    this.PIXIApp.loader.add(selected + '_atlas', `res/${selected}/${this.fileName[selected]}.atlas`, {"type": "atlas"})
                        .add(selected + '_skel', `res/${selected}/${this.fileName[selected]}.skel`, {"xhrType": "arraybuffer"})
                        .add(selected + '_png', `res/${selected}/${this.fileName[selected]}.png`)
                        .load(function (loader, resources) {
                            let skelBin = new SkeletonBinary(0.5);
                            skelBin.data = new Uint8Array(resources[selected + '_skel'].data);
                            skelBin.initJson();
                            let rawSkeletonData = skelBin.json;
                            let rawAtlasData = resources[selected + '_atlas'].data;
                            let spineAtlas = new PIXI.spine.core.TextureAtlas(rawAtlasData, function (line, callback) {
                                callback(PIXI.BaseTexture.from(selected + '_png'));
                            });
                            let spineAtlasLoader = new PIXI.spine.core.AtlasAttachmentLoader(spineAtlas);
                            let spineJsonParser = new PIXI.spine.core.SkeletonJson(spineAtlasLoader);
                            loader.res[selected] = spineJsonParser.readSkeletonData(rawSkeletonData);
                            loader.reloadSpine(selected);
                        });
                } else {
                    this.PIXIApp.loader.reloadSpine(selected);
                }

            },
            reloadSpine: function (selected, skin) {
                this.PIXIApp.stage.removeChildren();
                this.PIXIApp.spine = new PIXI.spine.Spine(this.PIXIApp.loader.res[selected]);
                let tempArray = [];
                this.PIXIApp.spine.spineData.animations.forEach(function (value) {
                    tempArray.push(value.name);
                });
                this.anime_options = tempArray;
                let anime = tempArray[0];
                tempArray = [];
                this.PIXIApp.spine.spineData.skins.forEach(function (value) {
                    tempArray.push(value.name);
                });
                this.skin_options = tempArray;
                if (!skin) {
                    skin = tempArray[0];
                    this.skin = skin;
                }
                this.PIXIApp.spine.skeleton.setSkin(null);
                this.PIXIApp.spine.skeleton.setSkinByName(skin);
                this.PIXIApp.stage.addChild(this.PIXIApp.spine);
                this.PIXIApp.spine.position.set(this.PIXIApp.view.width * 0.5, this.PIXIApp.view.height * 0.7);
                if (this.anime === anime) {
                    this.PIXIApp.spine.state.addAnimation(0, anime, this.loop);
                } else {
                    this.anime = anime;
                }
                this.loading = false;
            }
        },
        beforeCreate: function () {
            this.fileName = {
                Chris: "Chris_Skin02",
                C0:  "Chris",
                Alice:"Alice_Skin01",
                lambda:"Lambda",
                renne: "Renne"
            };
            let type = "WebGL";
            if (!PIXI.utils.isWebGLSupported()) {
                type = "canvas"
            }
            PIXI.utils.sayHello(type);
        },
        mounted: function () {
            this.PIXIApp = new PIXI.Application({width: 800, height: 700, transparent: true, view: this.$refs.spine});
            //this.$refs.spine.appendChild(this.PIXIApp.view);
            this.PIXIApp.start();
            this.PIXIApp.loader.res = {};
            this.PIXIApp.loader.reloadSpine = this.reloadSpine;
            this.loadData("aqua0");
        }
    }
</script>

<style>
    #app {
        font-family: 'Avenir', Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-align: center;
        color: #2c3e50;
        margin-top: 20px;
    }
</style>
