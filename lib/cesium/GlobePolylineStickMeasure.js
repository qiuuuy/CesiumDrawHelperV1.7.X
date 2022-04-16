var GlobePolylineStickMeasure = function () {
    this.init.apply(this, arguments);
};

GlobePolylineStickMeasure.prototype = {
    viewer: null,
    scene: null,
    clock: null,
    canvas: null,
    camera: null,
    ellipsoid: null,
    tooltip: null,
    entity: null,
    positions: [],
    tempPositions: [],
    drawHandler: null,
    modifyHandler: null,
    callback: null,
    dragIcon: "images/circle_gray.png",
    dragIconLight: "images/circle_red.png",
    material: null,
    toolBarIndex: null,
    markers: {},
    layerId: "globeDrawerLayer",
    init: function (viewer) {
        var _this = this;
        _this.viewer = viewer;
        _this.scene = viewer.scene;
        _this.clock = viewer.clock;
        _this.canvas = viewer.scene.canvas;
        _this.camera = viewer.scene.camera;
        _this.ellipsoid = viewer.scene.globe.ellipsoid;
        _this.tooltip = new GlobeTooltip(viewer.container);
    },
    clear: function () {
        var _this = this;
        if (_this.drawHandler) {
            _this.drawHandler.destroy();
            _this.drawHandler = null;
        }
        if (_this.modifyHandler) {
            _this.modifyHandler.destroy();
            _this.modifyHandler = null;
        }
        if (_this.toolBarIndex != null) {
            layer.close(_this.toolBarIndex);
        }
        _this._clearMarkers(_this.layerId);
        _this.tooltip.setVisible(false);
    },
    showModifyPolyline: function (positions, callback) {
        var _this = this;
        _this.positions = positions;
        _this.callback = callback;
        _this._showModifyPolyline2Map();
    },
    startDrawPolyline: function (callback) {
        var _this = this;
        _this.callback = callback;

        _this.positions = [];
        var floatingPoint = null;
        _this.drawHandler = new Cesium.ScreenSpaceEventHandler(_this.canvas);

        _this.drawHandler.setInputAction(function (event) {
            var position = event.position;
            if (!Cesium.defined(position)) {
                return;
            }
            var ray = _this.camera.getPickRay(position);
            if (!Cesium.defined(ray)) {
                return;
            }
            var cartesian = _this.scene.globe.pick(ray, _this.scene);
            if (!Cesium.defined(cartesian)) {
                return;
            }
            var num = _this.positions.length;
            if (num == 0) {
                _this.positions.push(cartesian);
                floatingPoint = _this._createPoint(cartesian, -1);
                _this._showPolyline2Map();
            }
            _this.positions.push(cartesian);
            var oid = _this.positions.length - 2;
            _this._createPoint(cartesian, oid);

            _this.entity.position = cartesian;
            var text = _this._getMeasureTip(_this.positions);
            _this.entity.label.text = text;
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        _this.drawHandler.setInputAction(function (event) {
            var position = event.endPosition;
            if (!Cesium.defined(position)) {
                return;
            }
            if (_this.positions.length < 1) {
                _this.tooltip.showAt(position, "<p>选择起点</p>");
                return;
            }
            var num = _this.positions.length;
            var tip = "<p>点击添加下一个点</p>";
            if (num > 2) {
                tip += "<p>右键结束绘制</p>";
            }
            _this.tooltip.showAt(position, tip);

            var ray = _this.camera.getPickRay(position);
            if (!Cesium.defined(ray)) {
                return;
            }
            var cartesian = _this.scene.globe.pick(ray, _this.scene);
            if (!Cesium.defined(cartesian)) {
                return;
            }
            floatingPoint.position.setValue(cartesian);
            _this.positions.pop();
            _this.positions.push(cartesian);

            _this.entity.position.setValue(cartesian);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        _this.drawHandler.setInputAction(function (movement) {
            if (_this.positions.length < 3) {
                return;
            }
            _this.positions.pop();
            _this.viewer.entities.remove(floatingPoint);
            _this.tooltip.setVisible(false);

            //进入编辑状态
            _this.clear();
            _this._showModifyPolyline2Map();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    },
    _startModify: function () {
        var _this = this;
        var isMoving = false;
        var pickedAnchor = null;
        if (_this.drawHandler) {
            _this.drawHandler.destroy();
            _this.drawHandler = null;
        }
        _this._showToolBar();

        _this.modifyHandler = new Cesium.ScreenSpaceEventHandler(_this.canvas);

        _this.modifyHandler.setInputAction(function (event) {
            var position = event.position;
            if (!Cesium.defined(position)) {
                return;
            }
            var ray = _this.camera.getPickRay(position);
            if (!Cesium.defined(ray)) {
                return;
            }
            var cartesian = _this.scene.globe.pick(ray, _this.scene);
            if (!Cesium.defined(cartesian)) {
                return;
            }
            if (isMoving) {
                isMoving = false;
                pickedAnchor.position.setValue(cartesian);
                var oid = pickedAnchor.oid;
                _this.tempPositions[oid] = cartesian;
                _this.tooltip.setVisible(false);
                if (pickedAnchor.flag == "mid_anchor") {
                    _this._updateModifyAnchors(oid);
                }

                _this.entity.position.setValue(cartesian);
                var text = _this._getMeasureTip(_this.tempPositions);
                _this.entity.label.text = text;
            } else {
                var pickedObject = _this.scene.pick(position);
                if (!Cesium.defined(pickedObject)) {
                    return;
                }
                if (!Cesium.defined(pickedObject.id)) {
                    return;
                }
                var entity = pickedObject.id;
                if (entity.layerId != _this.layerId) {
                    return;
                }
                if (entity.flag != "anchor" && entity.flag != "mid_anchor") {
                    return;
                }
                pickedAnchor = entity;
                isMoving = true;
                if (entity.flag == "anchor") {
                    _this.tooltip.showAt(position, "<p>移动控制点</p>");
                }
                if (entity.flag == "mid_anchor") {
                    _this.tooltip.showAt(position, "<p>移动创建新的控制点</p>");
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        _this.modifyHandler.setInputAction(function (event) {
            if (!isMoving) {
                return;
            }
            var position = event.endPosition;
            if (!Cesium.defined(position)) {
                return;
            }
            _this.tooltip.showAt(position, "<p>移动控制点</p>");

            var ray = _this.camera.getPickRay(position);
            if (!Cesium.defined(ray)) {
                return;
            }
            var cartesian = _this.scene.globe.pick(ray, _this.scene);
            if (!Cesium.defined(cartesian)) {
                return;
            }
            var oid = pickedAnchor.oid;
            if (pickedAnchor.flag == "anchor") {
                pickedAnchor.position.setValue(cartesian);
                _this.tempPositions[oid] = cartesian;
                //左右两个中点
                _this._updateNewMidAnchors(oid);
            } else if (pickedAnchor.flag == "mid_anchor") {
                pickedAnchor.position.setValue(cartesian);
                _this.tempPositions[oid] = cartesian;
            }

            _this.entity.position.setValue(cartesian);
            var text = _this._getMeasureTip(_this.tempPositions);
            _this.entity.label.text = text;
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    },
    _showPolyline2Map: function () {
        var _this = this;
        if (_this.material == null) {
            _this.material = new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.25,
                color: Cesium.Color.fromCssColorString('#00f').withAlpha(0.9)
            });
        }
        var dynamicPositions = new Cesium.CallbackProperty(function () {
            return _this.positions;
        }, false);
        var num = _this.positions.length;
        var last = _this.positions[num - 1];
        var bData = {
            position: last,
            label: {
                text: "",
                font: '16px "微软雅黑", Arial, Helvetica, sans-serif, Helvetica',
                fillColor: Cesium.Color.RED,
                outlineColor: Cesium.Color.SKYBLUE,
                outlineWidth: 1,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            polyline: {
                positions: dynamicPositions,
                clampToGround: true,
                width: 8,
                material: _this.material
            }
        };
        _this.entity = _this.viewer.entities.add(bData);
        _this.entity.layerId = _this.layerId;
    },
    _showModifyPolyline2Map: function () {
        var _this = this;

        _this._startModify();
        _this._computeTempPositions();

        var dynamicPositions = new Cesium.CallbackProperty(function () {
            return _this.tempPositions;
        }, false);
        if (_this.material == null) {
            _this.material = new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.25,
                color: Cesium.Color.fromCssColorString('#00f').withAlpha(0.9)
            });
        }
        var num = _this.tempPositions.length;
        var last = _this.tempPositions[num - 1];
        var text = _this._getMeasureTip(_this.tempPositions);
        var bData = {
            position: last,
            label: {
                text: text,
                font: '16px "微软雅黑", Arial, Helvetica, sans-serif, Helvetica',
                fillColor: Cesium.Color.RED,
                outlineColor: Cesium.Color.SKYBLUE,
                outlineWidth: 1,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            polyline: {
                positions: dynamicPositions,
                clampToGround: true,
                width: 8,
                material: _this.material
            }
        };
        _this.entity = _this.viewer.entities.add(bData);
        _this.entity.layerId = _this.layerId;
        var positions = _this.tempPositions;
        for (var i = 0; i < positions.length; i++) {
            var ys = i % 2;
            if (ys == 0) {
                _this._createPoint(positions[i], i);
            } else {
                _this._createMidPoint(positions[i], i);
            }
        }
    },
    _updateModifyAnchors: function (oid) {
        var _this = this;
        var num = _this.tempPositions.length;
        if (oid == 0 || oid == num - 1) {
            return;
        }
        //重新计算tempPositions
        var p = _this.tempPositions[oid];
        var p1 = _this.tempPositions[oid - 1];
        var p2 = _this.tempPositions[oid + 1];

        //计算中心
        var cp1 = _this._computeCenterPotition(p1, p);
        var cp2 = _this._computeCenterPotition(p, p2);

        //插入点
        var arr = [cp1, p, cp2];
        _this.tempPositions.splice(oid, 1, cp1, p, cp2);

        //重新加载锚点
        _this._clearAnchors(_this.layerId);
        var positions = _this.tempPositions;
        for (var i = 0; i < positions.length; i++) {
            var ys = i % 2;
            if (ys == 0) {
                _this._createPoint(positions[i], i);
            } else {
                _this._createMidPoint(positions[i], i);
            }
        }
    },
    _updateNewMidAnchors: function (oid) {
        var _this = this;
        if (oid == null || oid == undefined) {
            return;
        }
        //左边两个中点，oid2为临时中间点
        var oid1 = null;
        var oid2 = null;
        //右边两个中点，oid3为临时中间点
        var oid3 = null;
        var oid4 = null;

        var num = _this.tempPositions.length;
        if (oid == 0) {
            oid1 = num - 2;
            oid2 = num - 1;
            oid3 = oid + 1;
            oid4 = oid + 2;
        } else if (oid == num - 2) {
            oid1 = oid - 2;
            oid2 = oid - 1;
            oid3 = num - 1;
            oid4 = 0;
        } else {
            oid1 = oid - 2;
            oid2 = oid - 1;
            oid3 = oid + 1;
            oid4 = oid + 2;
        }

        var c1 = _this.tempPositions[oid1];
        var c = _this.tempPositions[oid];
        var c4 = _this.tempPositions[oid4];

        if (oid == 0) {
            var c3 = _this._computeCenterPotition(c4, c);
            _this.tempPositions[oid3] = c3;
            _this.markers[oid3].position.setValue(c3);
        } else if (oid == num - 1) {
            var c2 = _this._computeCenterPotition(c1, c);
            _this.tempPositions[oid2] = c2;
            _this.markers[oid2].position.setValue(c2);
        } else {
            var c2 = _this._computeCenterPotition(c1, c);
            var c3 = _this._computeCenterPotition(c4, c);
            _this.tempPositions[oid2] = c2;
            _this.tempPositions[oid3] = c3;
            _this.markers[oid2].position.setValue(c2);
            _this.markers[oid3].position.setValue(c3);
        }
    },
    _createPoint: function (cartesian, oid) {
        var _this = this;
        var bData = {
            position: cartesian,
            billboard: {
                image: _this.dragIconLight,
                eyeOffset: new Cesium.ConstantProperty(new Cesium.Cartesian3(0, 0, -500)),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        };
        var point = viewer.entities.add(bData);
        point.oid = oid;
        point.layerId = _this.layerId;
        point.flag = "anchor";
        _this.markers[oid] = point;
        return point;
    },
    _createMidPoint: function (cartesian, oid) {
        var _this = this;
        var point = viewer.entities.add({
            position: cartesian,
            billboard: {
                image: _this.dragIcon,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
        point.oid = oid;
        point.layerId = _this.layerId;
        point.flag = "mid_anchor";
        _this.markers[oid] = point;
        return point;
    },
    _getMeasureTip: function (pntList) {
        var _this = this;
        var dis3d = _this._computeLineDis3d(pntList);
        dis3d = dis3d.toFixed(3);
        var tip = "距离：" + dis3d + "千米";
        return tip;
    },
    _computeTempPositions: function () {
        var _this = this;

        var pnts = [].concat(_this.positions);
        var num = pnts.length;
        _this.tempPositions = [];
        for (var i = 1; i < num; i++) {
            var p1 = pnts[i - 1];
            var p2 = pnts[i];
            var cp = _this._computeCenterPotition(p1, p2);
            _this.tempPositions.push(p1);
            _this.tempPositions.push(cp);
        }
        var last = pnts[num - 1];
        _this.tempPositions.push(last);
    },
    _computeCenterPotition: function (p1, p2) {
        var _this = this;
        var c1 = _this.ellipsoid.cartesianToCartographic(p1);
        var c2 = _this.ellipsoid.cartesianToCartographic(p2);
        var cm = new Cesium.EllipsoidGeodesic(c1, c2).interpolateUsingFraction(0.5);
        var cp = _this.ellipsoid.cartographicToCartesian(cm);
        return cp;
    },
    _computeDis2d: function (c1, c2) {
        var dis = Cesium.Cartesian2.distance(c1, c2) / 1000;
        return dis;
    },
    _computeDis3d: function (p1, p2) {
        var dis = Cesium.Cartesian3.distance(p1, p2) / 1000;
        return dis;
    },
    _computeLineDis2d: function (pntList) {
        var _this = this;
        var total = 0;
        for (var i = 1; i < pntList.length; i++) {
            var p1 = pntList[i - 1];
            var p2 = pntList[i];
            var dis = _this._computeDis2d(p1, p2);
            total += dis;
        }
        return total;
    },
    _computeLineDis3d: function (pntList) {
        var _this = this;
        var total = 0;
        var positions = _this._getStick2GroundLine(pntList);
        for (var i = 1; i < positions.length; i++) {
            var p1 = positions[i - 1];
            var p2 = positions[i];
            var dis = _this._computeDis3d(p1, p2);
            total += dis;
        }
        return total;
    },
    //获取贴地线
    _getStick2GroundLine: function (positions) {
        var _this = this;

        var flatPositions = Cesium.PolylinePipeline.generateArc({
            positions: positions,
            granularity: 0.000001
        });
        var cartesianArray = [];
        for (var i = 0; i < flatPositions.length; i += 3) {
            var cartesian = Cesium.Cartesian3.unpack(flatPositions, i);
            cartesianArray.push(cartesian);
        }

        var raisedPositions = [];
        for (var i = 0; i < cartesianArray.length; i += 3) {
            var cartesian3 = _this._getStick2GroundPoint3d(cartesianArray[i]);
            raisedPositions.push(cartesian3);
        }
        return raisedPositions;
    },
    //获取高程值
    _getStick2GroundPoint3d: function (cartesian) {
        var _this = this;
        var viewer = _this.viewer;
        var ellipsoid = viewer.scene.globe.ellipsoid;

        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
        cartographic.height = viewer.scene.globe.getHeight(cartographic);
        var cartesian3 = ellipsoid.cartographicToCartesian(cartographic);
        return cartesian3;
    },
    _showToolBar: function () {
        var _this = this;
        _this._createToolBar();
        var width = $(window).width();
        var wTop = 60;
        var wLeft = parseInt((width - 145) / 2);
        _this.toolBarIndex = layer.open({
            title: false,
            type: 1,
            fixed: true,
            resize: false,
            shade: 0,
            content: $("#shapeEditContainer"),
            offset: [wTop + "px", wLeft + "px"],
            move: "#shapeEditRTCorner"
        });
        var cssSel = "#layui-layer" + _this.toolBarIndex + " .layui-layer-close2";
        $(cssSel).hide();
    },
    _createToolBar: function () {
        var _this = this;
        var objs = $("#shapeEditContainer");
        objs.remove();
        var html = '<div id="shapeEditContainer" style="padding: 10px 10px;">'
                 + '    <button name="btnOK" class="layui-btn layui-btn-xs layui-btn-normal"> <i class="layui-icon"></i> 确定 </button>'
                 + '    <button name="btnCancel" class="layui-btn layui-btn-xs layui-btn-danger"> <i class="layui-icon">ဆ</i> 取消 </button>'
                 + '    <div id="shapeEditRTCorner" style="width: 16px; position: absolute; right: 0px; top: 0px; bottom: 0px">'
                 + '    </div>'
                 + '</div>';
        $("body").append(html);

        var btnOK = $("#shapeEditContainer button[name='btnOK']");
        var btnCancel = $("#shapeEditContainer button[name='btnCancel']");
        btnOK.unbind("click").bind("click", function () {
            if (_this.callback) {
                var positions = [];
                for (var i = 0; i < _this.tempPositions.length; i += 2) {
                    var p = _this.tempPositions[i];
                    positions.push(p);
                }
                _this.positions = positions;

                _this.clear();
                layer.close(_this.toolBarIndex);

                var dis2d = _this._computeLineDis2d(positions);
                var dis3d = _this._computeLineDis3d(positions);
                dis2d = dis2d.toFixed(3);
                dis3d = dis3d.toFixed(3);

                var rlt = {
                    dis2d: dis2d,
                    dis3d: dis3d
                }
                _this.callback(positions, rlt);
            }
        });
        btnCancel.unbind("click").bind("click", function () {
            _this.clear();
            layer.close(_this.toolBarIndex);
        });
    },
    _isSimpleXYZ: function (p1, p2) {
        if (p1.x == p2.x && p1.y == p2.y && p1.z == p2.z) {
            return true;
        }
        return false;
    },
    _clearMarkers: function (layerName) {
        var _this = this;
        var viewer = _this.viewer;
        var entityList = viewer.entities.values;
        if (entityList == null || entityList.length < 1)
            return;
        for (var i = 0; i < entityList.length; i++) {
            var entity = entityList[i];
            if (entity.layerId == layerName) {
                viewer.entities.remove(entity);
                i--;
            }
        }
    },
    _clearAnchors: function () {
        var _this = this;
        for (var key in _this.markers) {
            var m = _this.markers[key];
            _this.viewer.entities.remove(m);
        }
        _this.markers = {};
    },
    CLASS_NAME: "GlobePolylineStickMeasure"
};