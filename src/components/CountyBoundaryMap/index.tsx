import { useEffect, useRef, useState } from 'react'
import { LineLayer, Scene } from '@antv/l7'
import { Map as L7Map } from '@antv/l7-maps'
import { Choropleth } from '@antv/l7plot'
import type { DistrictItem } from '@/utils/city'
import type { MapDevicePoint } from '@/types/mapDevice'
import type { AirQualityPoint } from '@/types/airData'
import { createDeviceMapLayers, type DeviceMapLayers } from '@/utils/mapDeviceLayers'
import { createAirQualityLayers, type AirMapLayers } from '@/utils/mapAirLayers'
import { addWaterRippleSurface } from '@/utils/mapWaterRipple'

interface CountyBoundaryMapProps {
  county: DistrictItem
  devicePoints?: MapDevicePoint[]
  airPoints?: AirQualityPoint[]
  onAirPointClick?: (point: AirQualityPoint) => void
}

export default function CountyBoundaryMap({ county, devicePoints = [], airPoints = [], onAirPointClick }: CountyBoundaryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const deviceLayersRef = useRef<DeviceMapLayers | null>(null)
  const devicePointsRef = useRef(devicePoints)
  const airLayersRef = useRef<AirMapLayers | null>(null)
  const airPointsRef = useRef(airPoints)
  const onAirPointClickRef = useRef(onAirPointClick)

  useEffect(() => {
    onAirPointClickRef.current = onAirPointClick
  }, [onAirPointClick])

  useEffect(() => {
    devicePointsRef.current = devicePoints
    deviceLayersRef.current?.setData(devicePoints)
  }, [devicePoints])

  useEffect(() => {
    airPointsRef.current = airPoints
    airLayersRef.current?.setData(airPoints)
  }, [airPoints])

  useEffect(() => {
    if (!containerRef.current) return
    setReady(false)

    const scene = new Scene({
      id: containerRef.current,
      logoVisible: false,
      map: new L7Map({
        style: {
          version: 8,
          name: 'monitor-county',
          sources: {},
          layers: [{
            id: 'background',
            type: 'background',
            paint: { 'background-color': 'rgba(5, 44, 96, 0.24)' },
          }],
        },
        center: [county.lng, county.lat],
        zoom: 9.5,
        minZoom: 8,
        maxZoom: 14,
        pitch: 0,
        bearing: 0,
      }),
    })

    scene.setBgColor('rgba(5, 44, 96, 0.24)')
    scene.on('loaded', async () => {
      scene.setMapStatus({
        dragEnable: true,
        zoomEnable: true,
        rotateEnable: false,
        doubleClickZoom: false,
      })

      const choropleth = new Choropleth({
        source: {
          data: [{ ...county, value: 1, fill: '#125a9e' }],
          joinBy: { sourceField: 'adcode', geoField: 'adcode' },
        },
        map: { type: 'map' },
        viewLevel: { level: 'district', adcode: Number(county.adcode) },
        color: { field: 'fill' },
        autoFit: true,
        chinaBorder: false,
        style: {
          opacity: 0.82,
          stroke: '#5DDDFF',
          lineWidth: 2,
          lineOpacity: 1,
        },
        label: {
          visible: true,
          field: 'name',
          style: {
            fill: '#f4fcff',
            fontSize: 14,
            stroke: '#0b477d',
            strokeWidth: 3,
          },
        },
      })
      choropleth.on('loaded', () => {
        // 添加发光边界线层
        const geoData = (choropleth.fillAreaLayer as any).getSource?.()?.data
        if (geoData) {
          const glowLine = new LineLayer({ zIndex: 6 })
            .source(geoData)
            .shape('line')
            .color('#5DDDFF')
            .size(1.2)
            .style({ opacity: 0.85 })
          scene.addLayer(glowLine)
        }
        // 水波纹表面层：在区域面上铺一层青色同心涟漪纹理（平面地图，高度从 0 起，层级在发光边界线之下）
        if (geoData) {
          addWaterRippleSurface(scene, geoData, 0, 5)
        }
        setReady(true)
      })
      choropleth.addToScene(scene)
      deviceLayersRef.current = await createDeviceMapLayers(scene, devicePointsRef.current)
      // 空气质量六级图标打点（平面地图，轻微抬高避免与填充面贴合）
      airLayersRef.current = await createAirQualityLayers(
        scene,
        airPointsRef.current,
        1000,
        point => onAirPointClickRef.current?.(point),
      )
    })

    return () => {
      deviceLayersRef.current = null
      airLayersRef.current = null
      scene.destroy()
    }
  }, [county])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(21,94,169,0.82)] text-[#dffbff] text-13px">
          正在加载{county.name}地图...
        </div>
      )}
    </div>
  )
}
