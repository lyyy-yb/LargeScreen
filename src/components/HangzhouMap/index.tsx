import React, { useEffect, useRef, useState } from "react";
import { Scene, PointLayer, PolygonLayer, LineLayer } from "@antv/l7";
import { Map as L7Map } from "@antv/l7-maps";
import { Choropleth } from "@antv/l7plot";
import { districts } from '@/utils/city';

const HangzhouMap = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("Map container has zero size");
      return;
    }

    const hangzhouDistricts = districts.filter((d) => d.parent === 330100);

    const districtData = hangzhouDistricts.map((d) => ({
      name: d.name,
      adcode: d.adcode,
      value: Math.floor(Math.random() * 30) + 35,
      lng: d.lng,
      lat: d.lat,
    }));

    const scene = new Scene({
      id: containerRef.current,
      map: new L7Map({
        style: {
          version: 8,
          name: "dark",
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: {
                "background-color": "#0a1628",
              },
            },
          ],
        },
        center: [119.8, 29.85],
        zoom: 8.2,
        minZoom: 7.0,
        maxZoom: 12,
        pitch: 0,
        bearing: 0,
      }),
      logoVisible: false,
    });

    scene.on("loaded", () => {
      setMapLoaded(true);

      const choropleth = new Choropleth({
        source: {
          data: districtData,
          joinBy: {
            sourceField: "adcode",
            geoField: "adcode",
          },
        },
        map: {
          type: "map",
        },
        viewLevel: {
          level: "city",
          adcode: 330100,
        },
        color: {
          field: "value",
          value: ["#00e400", "#7ed321", "#a8e063", "#ffdc00", "#ff7e00", "#ff4757"],
          scale: { type: "quantile" },
        },
        style: {
          opacity: 0.7,
          stroke: "#00d4ff",
          lineWidth: 2,
          lineOpacity: 0.9,
        },
        label: {
          visible: true,
          field: "name",
          style: {
            fill: "#ffffff",
            opacity: 0.9,
            fontSize: 12,
            stroke: "#0a1628",
            strokeWidth: 3,
            textAllowOverlap: false,
          },
        },
        state: {
          active: { stroke: "#00ffff", lineWidth: 2 },
        },
      });
      choropleth.addToScene(scene);

      const airQualityStations = [
        { lng: 120.15, lat: 30.28, pm25: 45, o3: 35, temperature: 18, humidity: 65, name: "西湖区监测站", district: "西湖区" },
        { lng: 120.35, lat: 30.15, pm25: 62, o3: 48, temperature: 20, humidity: 58, name: "萧山区监测站", district: "萧山区" },
        { lng: 119.98, lat: 30.45, pm25: 38, o3: 32, temperature: 16, humidity: 72, name: "余杭区监测站", district: "余杭区" },
        { lng: 120.05, lat: 29.95, pm25: 55, o3: 42, temperature: 22, humidity: 52, name: "富阳区监测站", district: "富阳区" },
        { lng: 120.25, lat: 30.10, pm25: 78, o3: 55, temperature: 24, humidity: 48, name: "滨江区监测站", district: "滨江区" },
        { lng: 120.10, lat: 30.35, pm25: 42, o3: 38, temperature: 17, humidity: 68, name: "拱墅区监测站", district: "拱墅区" },
        { lng: 120.40, lat: 30.22, pm25: 58, o3: 45, temperature: 21, humidity: 55, name: "钱塘区监测站", district: "钱塘区" },
        { lng: 119.85, lat: 30.18, pm25: 35, o3: 30, temperature: 15, humidity: 75, name: "临安区监测站", district: "临安区" },
        { lng: 120.00, lat: 30.05, pm25: 48, o3: 40, temperature: 19, humidity: 62, name: "桐庐县监测站", district: "桐庐县" },
        { lng: 119.65, lat: 29.85, pm25: 40, o3: 33, temperature: 16, humidity: 70, name: "建德市监测站", district: "建德市" },
        { lng: 120.20, lat: 29.65, pm25: 36, o3: 31, temperature: 14, humidity: 78, name: "淳安县监测站", district: "淳安县" },
      ];

      const airStationLayer = new PointLayer({ zIndex: 2 })
        .source(airQualityStations, {
          parser: {
            type: "json",
            x: "lng",
            y: "lat",
          },
        })
        .shape("circle")
        .size("pm25", (v: number) => {
          return Math.max(10, Math.min(22, v * 0.3));
        })
        .color("pm25", (v: number) => {
          if (v <= 35) return "#00e400";
          if (v <= 75) return "#ffff00";
          if (v <= 115) return "#ff7e00";
          if (v <= 150) return "#ff0000";
          if (v <= 250) return "#99004c";
          return "#7e0023";
        })
        .style({
          opacity: 0.9,
          stroke: "#ffffff",
          strokeWidth: 2,
          shadowColor: (v: any) => {
            const pm25 = v.pm25;
            if (pm25 <= 35) return "rgba(0, 228, 0, 0.6)";
            if (pm25 <= 75) return "rgba(255, 255, 0, 0.6)";
            if (pm25 <= 115) return "rgba(255, 126, 0, 0.6)";
            return "rgba(255, 0, 0, 0.6)";
          },
          shadowBlur: 15,
        });

      scene.addLayer(airStationLayer);

      const quantumRadarStations = [
        { lng: 120.18, lat: 30.30, name: "西湖雷达站", status: "online", coverageRadius: 5 },
        { lng: 120.30, lat: 30.18, name: "萧山雷达站", status: "online", coverageRadius: 4 },
        { lng: 120.00, lat: 30.42, name: "余杭雷达站", status: "offline", coverageRadius: 4.5 },
        { lng: 120.22, lat: 30.05, name: "滨江雷达站", status: "online", coverageRadius: 5 },
      ];

      const radarCoverageData = quantumRadarStations.map((station, idx) => {
        const points = [];
        const radius = station.coverageRadius * 0.01;
        for (let i = 0; i <= 360; i += 10) {
          const angle = (i * Math.PI) / 180;
          points.push([
            station.lng + radius * Math.cos(angle),
            station.lat + radius * Math.sin(angle),
          ]);
        }
        return {
          id: idx,
          name: station.name,
          lng: station.lng,
          lat: station.lat,
          status: station.status,
          coordinates: [points],
        };
      });

      const radarCoverageLayer = new PolygonLayer({ zIndex: 1 })
        .source(radarCoverageData, {
          parser: {
            type: "json",
            coordinates: "coordinates",
          },
        })
        .color("status", (v: string) => {
          return v === "online" ? "rgba(138, 43, 226, 0.2)" : "rgba(100, 100, 100, 0.1)";
        })
        .style({
          opacity: 0.5,
          stroke: (v: any) => (v.status === "online" ? "#8a2be2" : "#666666"),
          strokeWidth: 2,
          strokeOpacity: 0.7,
        });

      scene.addLayer(radarCoverageLayer);

      const radarPointLayer = new PointLayer({ zIndex: 4 })
        .source(quantumRadarStations, {
          parser: {
            type: "json",
            x: "lng",
            y: "lat",
          },
        })
        .shape("circle")
        .size("status", (v: string) => (v === "online" ? 20 : 16))
        .color("status", (v: string) => (v === "online" ? "#8a2be2" : "#666666"))
        .style({
          opacity: 0.9,
          stroke: "#ffffff",
          strokeWidth: 3,
          shadowColor: (v: any) =>
            v.status === "online" ? "rgba(138, 43, 226, 0.8)" : "rgba(100, 100, 100, 0.5)",
          shadowBlur: 20,
        });

      scene.addLayer(radarPointLayer);

      const droneAirports = [
        { lng: 120.10, lat: 30.25, name: "临平机场", status: "online" },
        { lng: 120.28, lat: 30.12, name: "萧山机场", status: "online" },
        { lng: 119.95, lat: 30.40, name: "余杭机场", status: "offline" },
        { lng: 120.08, lat: 29.98, name: "富阳机场", status: "online" },
        { lng: 120.22, lat: 30.08, name: "滨江机场", status: "offline" },
      ];

      const droneAirportLayer = new PointLayer({ zIndex: 5 })
        .source(droneAirports, {
          parser: {
            type: "json",
            x: "lng",
            y: "lat",
          },
        })
        .shape("circle")
        .size("status", (v: string) => (v === "online" ? 18 : 14))
        .color("status", (v: string) => (v === "online" ? "#00d4ff" : "#666666"))
        .style({
          opacity: 0.9,
          stroke: "#ffffff",
          strokeWidth: 2,
          shadowColor: (v: any) =>
            v.status === "online" ? "rgba(0, 212, 255, 0.8)" : "rgba(100, 100, 100, 0.5)",
          shadowBlur: 15,
        });

      scene.addLayer(droneAirportLayer);

      const activeFlightTasks = [
        {
          id: "FLT001",
          name: "西湖区污染源巡查",
          from: { lng: 120.10, lat: 30.25 },
          to: { lng: 120.18, lat: 30.22 },
          currentPos: { lng: 120.14, lat: 30.24 },
          progress: 55,
          startTime: "14:30",
          estimatedTime: "15:15",
        },
        {
          id: "FLT002",
          name: "萧山区环境监测",
          from: { lng: 120.28, lat: 30.12 },
          to: { lng: 120.35, lat: 30.08 },
          currentPos: { lng: 120.32, lat: 30.10 },
          progress: 72,
          startTime: "14:20",
          estimatedTime: "14:50",
        },
        {
          id: "FLT003",
          name: "富阳区航拍巡查",
          from: { lng: 120.08, lat: 29.98 },
          to: { lng: 120.00, lat: 30.05 },
          currentPos: { lng: 120.04, lat: 30.02 },
          progress: 38,
          startTime: "14:45",
          estimatedTime: "15:30",
        },
      ];

      const flightPathData = activeFlightTasks.map((task) => ({
        id: task.id,
        coordinates: [
          [task.from.lng, task.from.lat],
          [task.to.lng, task.to.lat],
        ],
        progress: task.progress,
      }));

      const flightPathLayer = new LineLayer({ zIndex: 3 })
        .source(flightPathData, {
          parser: {
            type: "json",
            coordinates: "coordinates",
          },
        })
        .color("#00d4ff")
        .size(3)
        .style({
          opacity: 0.6,
          lineCap: "round",
          lineJoin: "round",
        });

      scene.addLayer(flightPathLayer);

      const dronePositionLayer = new PointLayer({ zIndex: 7 })
        .source(activeFlightTasks, {
          parser: {
            type: "json",
            x: "currentPos.lng",
            y: "currentPos.lat",
          },
        })
        .shape("circle")
        .size(16)
        .color("#00ff88")
        .style({
          opacity: 0.95,
          stroke: "#ffffff",
          strokeWidth: 3,
          shadowColor: "rgba(0, 255, 136, 0.9)",
          shadowBlur: 20,
        });

      scene.addLayer(dronePositionLayer);

      const alertPoints = [
        { lng: 120.15, lat: 30.28, level: "level1", ruleName: "PM2.5严重超标", district: "西湖区" },
        { lng: 120.35, lat: 30.15, level: "level2", ruleName: "PM2.5浓度超标", district: "萧山区" },
        { lng: 119.98, lat: 30.45, level: "level2", ruleName: "TSP超标", district: "余杭区" },
        { lng: 120.05, lat: 29.95, level: "level3", ruleName: "PM10超标", district: "富阳区" },
        { lng: 120.25, lat: 30.10, level: "level1", ruleName: "PM2.5严重超标", district: "滨江区" },
      ];

      const alertLayer = new PointLayer({ zIndex: 6 })
        .source(alertPoints, {
          parser: {
            type: "json",
            x: "lng",
            y: "lat",
          },
        })
        .shape("triangle")
        .size("level", (v: string) => {
          switch (v) {
            case "level1": return 28;
            case "level2": return 24;
            case "level3": return 20;
            default: return 22;
          }
        })
        .color("level", (v: string) => {
          switch (v) {
            case "level1": return "#ff0000";
            case "level2": return "#ff7e00";
            case "level3": return "#ffdc00";
            case "level4": return "#00d4ff";
            default: return "#ff7e00";
          }
        })
        .style({
          opacity: 0.95,
          stroke: "#ffffff",
          strokeWidth: 3,
          shadowColor: (v: any) => {
            switch (v.level) {
              case "level1": return "rgba(255, 0, 0, 0.8)";
              case "level2": return "rgba(255, 126, 0, 0.8)";
              case "level3": return "rgba(255, 220, 0, 0.8)";
              default: return "rgba(0, 212, 255, 0.8)";
            }
          },
          shadowBlur: 20,
        });

      scene.addLayer(alertLayer);
    });

    return () => {
      scene.destroy();
    };
  }, []);

  return (
    <div className="relative w-full h-full" style={{ minHeight: "600px" }}>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: "600px", height: "100%" }} />

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]/80 z-20">
          <div className="text-cyan-400 text-sm">地图加载中...</div>
        </div>
      )}

      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md rounded-xl p-3 border border-red-500/30 shadow-lg z-10">
        <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
          <svg className="w-3 h-3 text-red-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L20 20H4L12 2Z" />
          </svg>
          <span>预警点位</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M12 2L20 20H4L12 2Z" fill="#dc2626" stroke="white" strokeWidth="2" />
          </svg>
          <span className="text-white text-xs">一级预警</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M12 2L20 20H4L12 2Z" fill="#f97316" stroke="white" strokeWidth="2" />
          </svg>
          <span className="text-white text-xs">二级预警</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M12 2L20 20H4L12 2Z" fill="#eab308" stroke="white" strokeWidth="2" />
          </svg>
          <span className="text-white text-xs">三级预警</span>
        </div>
      </div>

      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md rounded-xl p-3 border border-green-500/30 shadow-lg z-10">
        <div className="flex items-center gap-2 text-green-400 font-bold text-sm mb-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span>空气质量检测站</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500 shadow-md shadow-green-500/50"></div>
          <span className="text-white text-xs">优 (0-35)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-md shadow-yellow-500/50"></div>
          <span className="text-white text-xs">良 (36-75)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-orange-500 shadow-md shadow-orange-500/50"></div>
          <span className="text-white text-xs">轻度污染</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-md shadow-red-500/50"></div>
          <span className="text-white text-xs">中度及以上</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md rounded-xl p-3 border border-purple-500/30 shadow-lg z-10">
        <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
          <div className="w-2 h-2 rounded-full bg-purple-400"></div>
          <span>光量子雷达站</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-purple-500 shadow-md shadow-purple-500/50"></div>
          <span className="text-white text-xs">在线</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500 shadow-md shadow-gray-500/50"></div>
          <span className="text-white text-xs">离线</span>
        </div>
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="text-white/50 text-xs">紫色区域为雷达覆盖范围</div>
        </div>
      </div>

      <div className="absolute top-4 left-[160px] bg-black/70 backdrop-blur-md rounded-xl p-3 border border-cyan-500/30 shadow-lg z-10">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
          <span>无人机机场</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-md shadow-cyan-500/50"></div>
          <span className="text-white text-xs">在线</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-gray-500 shadow-md shadow-gray-500/50"></div>
          <span className="text-white text-xs">离线</span>
        </div>
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-[2px] bg-cyan-500"></div>
            <span className="text-white text-xs">飞行路线</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400 shadow-md shadow-green-400/50"></div>
            <span className="text-white text-xs">飞行中无人机</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md rounded-xl p-3 border border-cyan-500/30 shadow-lg z-10">
        <div className="text-cyan-400 font-bold text-sm">杭州市环境监测分布</div>
        <div className="text-white/60 text-xs mt-1">共 11 个空气质量检测站</div>
        <div className="text-white/60 text-xs">4 个光量子雷达站 | 5 个无人机机场</div>
        <div className="text-green-400 text-xs mt-1">3 个飞行任务进行中</div>
      </div>
    </div>
  );
};

export default HangzhouMap;
