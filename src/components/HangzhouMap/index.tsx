import React, { useEffect, useRef, useState } from "react";
import { Scene, PointLayer, PolygonLayer, LineLayer } from "@antv/l7";
import { Mapbox } from "@antv/l7-maps";

import { Choropleth } from "@antv/l7plot";
import { districts } from '@/utils/city';

interface HangzhouMapProps {
  showOverlays?: boolean
}

function createSectorCoordinates(
  lng: number,
  lat: number,
  radius: number,
  startAngle: number,
  sweepAngle: number,
) {
  const points: number[][] = [[lng, lat]]
  const steps = 22
  for (let step = 0; step <= steps; step += 1) {
    const angle = ((startAngle + (sweepAngle * step) / steps) * Math.PI) / 180
    points.push([
      lng + radius * Math.cos(angle),
      lat + radius * Math.sin(angle),
    ])
  }
  points.push([lng, lat])
  return [points]
}

const HangzhouMap: React.FC<HangzhouMapProps> = ({ showOverlays = false }) => {

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

    const districtPalette = [
      '#126ab1', '#0d78bd', '#0b5f9e', '#1680c2', '#106ead',
      '#0c64a8', '#1883c4', '#0b5b9a', '#1176b7', '#0d67a4',
      '#157dbb', '#0b609d', '#1372b3',
    ]
    const districtData = hangzhouDistricts.map((d, index) => ({
      name: d.name,
      adcode: d.adcode,
      value: 36 + (index * 9) % 38,
      height: 19000 + (index % 4) * 4200,
      fill: districtPalette[index % districtPalette.length],
      lng: d.lng,
      lat: d.lat,
    }));

    const scene = new Scene({
      id: containerRef.current,
      map: new Mapbox({
        style: 'blank',
        center: [119.88, 29.86],
        zoom: 8.55,
        pitch: 28,
        rotation: -6,
        minZoom: 7.0,
        maxZoom: 12,
      }),
      logoVisible: false,
    });
    scene.setBgColor('#03122c');


    scene.on("loaded", () => {
      setMapLoaded(true);
      let districtGeoData: any = null;

      const choropleth = new Choropleth({
        zIndex: 4,
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
        chinaBorder: false,
        // 行政边界数据已本地化到 public/map，避免访问外部 HTTPS 资源
        customFetchGeoData: async ({ adcode }) => {
          const response = await fetch(`/map/${adcode}_full.json`)
          const geoData = await response.json()
          if (String(adcode) === '330100') districtGeoData = geoData
          return geoData
        },
        autoFit: false,
        color: {
          field: "value",
          value: districtPalette,
        },
        style: {
          opacity: 0.78,
          stroke: "#47d7f4",
          lineWidth: 1.05,
          lineOpacity: 0.92,
        },

        label: {
          visible: true,
          field: "name",
          style: {
            fill: "#d1f6ff",
            opacity: 0.95,
            fontSize: 12,
            fontWeight: "bold",
            stroke: "#03264f",
            strokeWidth: 3.5,
            textAllowOverlap: false,
          },
        },
        state: {
          active: { fill: "#25a8e8", stroke: "#ffffff", lineWidth: 2.2 },
        },
      });
      choropleth.on("loaded", () => {
        if (!districtGeoData?.features?.length) return

        const metricsByAdcode = new Map(districtData.map(item => [String(item.adcode), item]))
        const styledGeoData = {
          ...districtGeoData,
          features: districtGeoData.features.map((feature: any) => {
            const adcode = String(feature.properties?.adcode ?? '')
            const metric = metricsByAdcode.get(adcode)
            return {
              ...feature,
              properties: {
                ...feature.properties,
                height: metric?.height ?? 22000,
                fill: metric?.fill ?? '#0a62a6',
              },
            }
          }),
        }

        const districtWallLayer = new LineLayer({ zIndex: 1 })
          .source(styledGeoData)
          .shape("wall")
          .size(23000)
          .style({
            heightfixed: true,
            opacity: 0.72,
            sourceColor: "#05336d",
            targetColor: "rgba(0, 219, 255, 0.62)",
          })
        scene.addLayer(districtWallLayer)

        const districtPrismLayer = new PolygonLayer({ zIndex: 2, autoFit: false })
          .source(styledGeoData)
          .shape("extrude")
          .size(26000)
          .color("fill")
          .style({
            heightfixed: true,
            pickLight: true,
            opacity: 0.96,
            sourceColor: "#042f68",
            targetColor: "#23b5e8",
          })
        scene.addLayer(districtPrismLayer)

        const districtTopLineLayer = new LineLayer({ zIndex: 3 })
          .source(styledGeoData)
          .shape("line")
          .color("#62e8ff")
          .size(1.35)
          .style({
            raisingHeight: 26000,
            opacity: 0.9,
          })
        scene.addLayer(districtTopLineLayer)
      })
      choropleth.addToScene(scene);

      const airQualityStations = [
        { lng: 120.15, lat: 30.28, pm25: 5.6, name: "西湖区监测站", district: "西湖区" },
        { lng: 120.35, lat: 30.15, pm25: 5.6, name: "萧山区监测站", district: "萧山区" },
        { lng: 119.98, lat: 30.45, pm25: 5.6, name: "余杭区监测站", district: "余杭区" },
        { lng: 120.05, lat: 29.95, pm25: 5.6, name: "富阳区监测站", district: "富阳区" },
        { lng: 120.25, lat: 30.10, pm25: 5.6, name: "滨江区监测站", district: "滨江区" },
        { lng: 120.10, lat: 30.35, pm25: 5.6, name: "拱墅区监测站", district: "拱墅区" },
        { lng: 120.40, lat: 30.22, pm25: 5.6, name: "钱塘区监测站", district: "钱塘区" },
        { lng: 119.85, lat: 30.18, pm25: 5.6, name: "临安区监测站", district: "临安区" },
        { lng: 120.00, lat: 30.05, pm25: 5.6, name: "桐庐县监测站", district: "桐庐县" },
        { lng: 119.65, lat: 29.85, pm25: 5.6, name: "建德市监测站", district: "建德市" },
        { lng: 120.20, lat: 29.65, pm25: 5.6, name: "淳安县监测站", district: "淳安县" },
      ];

      const airStationLayer = new PointLayer({ zIndex: 8 })
        .source(airQualityStations, {
          parser: { type: "json", x: "lng", y: "lat" },
        })
        .shape("circle")
        .size(6.5)
        .color("pm25", (value: number) => value > 35 ? "#ffd744" : "#2df0a7")
        .style({
          opacity: 0.95,
          stroke: "#d9ffff",
          strokeWidth: 1.2,
          shadowColor: "rgba(22, 235, 202, 0.8)",
          shadowBlur: 8,
        });

      scene.addLayer(airStationLayer);

      const auxiliaryNodes = hangzhouDistricts.flatMap((district, districtIndex) => {
        const nodeColors = ["#21e6a4", "#f4db35", "#9aabba"]
        return [
          {
            lng: district.lng + 0.045,
            lat: district.lat + 0.028,
            color: nodeColors[districtIndex % nodeColors.length],
          },
          {
            lng: district.lng - 0.038,
            lat: district.lat - 0.024,
            color: nodeColors[(districtIndex + 1) % nodeColors.length],
          },
        ]
      })

      const auxiliaryNodeLayer = new PointLayer({ zIndex: 8 })
        .source(auxiliaryNodes, {
          parser: { type: "json", x: "lng", y: "lat" },
        })
        .shape("circle")
        .size(4.2)
        .color("color")
        .style({
          opacity: 0.86,
          stroke: "#d8ffff",
          strokeWidth: 0.7,
          shadowBlur: 5,
        })
      scene.addLayer(auxiliaryNodeLayer)

      const quantumRadarStations = [
        { lng: 119.85, lat: 30.18, name: "临安雷达站", status: "online", radius: 0.20, start: 90, sweep: 180, coverageColor: "#14d8c7" },
        { lng: 120.05, lat: 29.95, name: "富阳雷达站", status: "online", radius: 0.19, start: -90, sweep: 180, coverageColor: "#1cd6cc" },
        { lng: 120.35, lat: 30.15, name: "萧山雷达站", status: "online", radius: 0.20, start: -90, sweep: 185, coverageColor: "#1ee0cd" },
        { lng: 120.15, lat: 30.28, name: "西湖雷达站", status: "online", radius: 0.18, start: 82, sweep: 180, coverageColor: "#1acbd5" },
        { lng: 119.62, lat: 29.78, name: "淳安雷达站", status: "online", radius: 0.18, start: -90, sweep: 185, coverageColor: "#21d4c7" },
      ];

      const radarCoverageData = quantumRadarStations.map((station, idx) => {
        return {
          id: idx,
          name: station.name,
          lng: station.lng,
          lat: station.lat,
          status: station.status,
          coverageColor: station.coverageColor,
          coordinates: createSectorCoordinates(
            station.lng,
            station.lat,
            station.radius,
            station.start,
            station.sweep,
          ),
        };
      });

      const radarCoverageLayer = new PolygonLayer({ zIndex: 5 })
        .source(radarCoverageData, {
          parser: { type: "json", coordinates: "coordinates" },
        })
        .color("coverageColor")
        .style({
          opacity: 0.22,
          stroke: "#48f4e7",
          strokeWidth: 0.8,
          strokeOpacity: 0.45,
        });

      scene.addLayer(radarCoverageLayer);

      const radarPointLayer = new PointLayer({ zIndex: 9 })
        .source(quantumRadarStations, {
          parser: { type: "json", x: "lng", y: "lat" },
        })
        .shape("circle")
        .size(7)
        .color("#ffdc38")
        .style({
          opacity: 0.95,
          stroke: "#ffffff",
          strokeWidth: 1.2,
          shadowColor: "rgba(255, 220, 56, 0.92)",
          shadowBlur: 8,
        });

      scene.addLayer(radarPointLayer);



      const droneAirports = [
        { lng: 120.10, lat: 30.25, name: "临平机场", status: "online" },
        { lng: 120.28, lat: 30.12, name: "萧山机场", status: "online" },
        { lng: 119.95, lat: 30.40, name: "余杭机场", status: "offline" },
        { lng: 120.08, lat: 29.98, name: "富阳机场", status: "online" },
        { lng: 120.22, lat: 30.08, name: "滨江机场", status: "offline" },
      ];

      const droneAirportLayer = new PointLayer({ zIndex: 10 })
        .source(droneAirports, {
          parser: {
            type: "json",
            x: "lng",
            y: "lat",
          },
        })
        .shape("circle")
        .size("status", (v: string) => (v === "online" ? 7 : 6))
        .color("status", (v: string) => (v === "online" ? "#20e5a5" : "#8c9bad"))
        .style({
          opacity: 0.9,
          stroke: "#e6ffff",
          strokeWidth: 1.1,
          shadowColor: (v: any) =>
            v.status === "online" ? "rgba(32, 229, 165, 0.8)" : "rgba(100, 100, 100, 0.5)",
          shadowBlur: 7,
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
          name: "淳安—富阳航拍巡查",
          from: { lng: 119.52, lat: 29.76 },
          to: { lng: 119.88, lat: 30.02 },
          currentPos: { lng: 119.69, lat: 29.89 },
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

      const flightPathLayer = new LineLayer({ zIndex: 7 })
        .source(flightPathData, {
          parser: {
            type: "json",
            coordinates: "coordinates",
          },
        })
        .color("#00d4ff")
        .size(1.5)
        .style({
          opacity: 0.84,
          lineCap: "round",
          lineJoin: "round",
          lineType: "dash",
          dashArray: [3, 3],
        });

      scene.addLayer(flightPathLayer);

      const dronePositionLayer = new PointLayer({ zIndex: 11 })
        .source(activeFlightTasks, {
          parser: {
            type: "json",
            x: "currentPos.lng",
            y: "currentPos.lat",
          },
        })
        .shape("circle")
        .size(7.5)
        .color("#00efff")
        .style({
          opacity: 0.95,
          stroke: "#ffffff",
          strokeWidth: 1.2,
          shadowColor: "rgba(0, 239, 255, 0.9)",
          shadowBlur: 9,
        });

      scene.addLayer(dronePositionLayer);

      const alertPoints = [
        { lng: 120.15, lat: 30.28, level: "level1", ruleName: "PM2.5严重超标", district: "西湖区" },
        { lng: 120.35, lat: 30.15, level: "level2", ruleName: "PM2.5浓度超标", district: "萧山区" },
        { lng: 119.98, lat: 30.45, level: "level2", ruleName: "TSP超标", district: "余杭区" },
        { lng: 120.05, lat: 29.95, level: "level3", ruleName: "PM10超标", district: "富阳区" },
        { lng: 120.25, lat: 30.10, level: "level1", ruleName: "PM2.5严重超标", district: "滨江区" },
      ];

      const alertLayer = new PointLayer({ zIndex: 12 })
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
            case "level1": return 8;
            case "level2": return 7;
            case "level3": return 6;
            default: return 6.5;
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
          strokeWidth: 1.4,
          shadowColor: (v: any) => {
            switch (v.level) {
              case "level1": return "rgba(255, 0, 0, 0.8)";
              case "level2": return "rgba(255, 126, 0, 0.8)";
              case "level3": return "rgba(255, 220, 0, 0.8)";
              default: return "rgba(0, 212, 255, 0.8)";
            }
          },
          shadowBlur: 9,
        });

      scene.addLayer(alertLayer);
    });

    return () => {
      scene.destroy();
    };
  }, []);

  return (
    <div className="hangzhou-map relative w-full h-full" style={{ minHeight: "600px" }}>
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: "600px", height: "100%" }} />

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1628]/80 z-20">
          <div className="text-cyan-400 text-sm">地图加载中...</div>
        </div>
      )}

      {showOverlays && (
        <>
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
        </>
      )}
    </div>
  );
};

export default HangzhouMap;
