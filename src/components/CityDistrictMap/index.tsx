import { useEffect, useRef, useState } from 'react'
import { PointLayer, Scene } from '@antv/l7'
import { Map as L7Map } from '@antv/l7-maps'
import { Choropleth } from '@antv/l7plot'
import type { CityItem, DistrictItem } from '@/utils/city'

interface CityDistrictMapProps {
  city: CityItem
  districtItems: DistrictItem[]
  selectedDistrict?: string
  onDistrictClick?: (districtName: string, adcode: number) => void
  onDistrictHover?: (districtName: string | null) => void
}

const areaPalette = ['#1c68aa', '#2377b8', '#1b62a2', '#2b82c0', '#246fae']

function makeDistrictData(items: DistrictItem[], selectedDistrict?: string) {
  return items.map((item, index) => ({
    ...item,
    value: 35 + (index * 7) % 28,
    selected: item.name === selectedDistrict,
    fill: item.name === selectedDistrict ? '#43def4' : areaPalette[index % areaPalette.length],
  }))
}

export default function CityDistrictMap({
  city,
  districtItems,
  selectedDistrict,
  onDistrictClick,
  onDistrictHover,
}: CityDistrictMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const plotRef = useRef<Choropleth | null>(null)
  const stationLayerRef = useRef<PointLayer | null>(null)
  const onClickRef = useRef(onDistrictClick)
  const onHoverRef = useRef(onDistrictHover)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onClickRef.current = onDistrictClick
  }, [onDistrictClick])

  useEffect(() => {
    onHoverRef.current = onDistrictHover
  }, [onDistrictHover])

  useEffect(() => {
    plotRef.current?.changeData(makeDistrictData(districtItems, selectedDistrict))
    stationLayerRef.current?.setData(districtItems.map(item => ({ ...item, selected: item.name === selectedDistrict })), {
      parser: { type: 'json', x: 'lng', y: 'lat' },
    })
  }, [districtItems, selectedDistrict])

  useEffect(() => {
    if (!containerRef.current) return

    setReady(false)
    const scene = new Scene({
      id: containerRef.current,
      logoVisible: false,
      map: new L7Map({
        style: {
          version: 8,
          name: 'monitor-city',
          sources: {},
          layers: [{
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#155ea9' },
          }],
        },
        center: [city.lng, city.lat],
        zoom: 8,
        minZoom: 6,
        maxZoom: 12,
        pitch: 0,
        bearing: 0,
      }),
    })
    scene.setBgColor('#155ea9')
    sceneRef.current = scene

    scene.on('loaded', () => {
      scene.setMapStatus({
        dragEnable: true,
        zoomEnable: true,
        rotateEnable: false,
        doubleClickZoom: false,
      })

      const choropleth = new Choropleth({
        source: {
          data: makeDistrictData(districtItems, selectedDistrict),
          joinBy: { sourceField: 'adcode', geoField: 'adcode' },
        },
        map: { type: 'map' },
        viewLevel: { level: 'city', adcode: Number(city.adcode) },
        color: { field: 'fill' },
        autoFit: true,
        chinaBorder: false,
        style: {
          opacity: 0.94,
          stroke: '#70e8ff',
          lineWidth: 1.6,
          lineOpacity: 0.92,
        },
        label: {
          visible: true,
          field: 'name',
          style: {
            fill: '#f4fcff',
            opacity: 1,
            fontSize: 12,
            stroke: '#0b477d',
            strokeWidth: 2.5,
            textAllowOverlap: false,
            padding: [4, 4],
          },
        },
        state: {
          active: { fill: '#50dcff', stroke: '#ffffff', lineWidth: 2.5 },
          select: { fill: '#43def4', stroke: '#ffffff', lineWidth: 3.5 },
        },
      })

      choropleth.on('loaded', () => {
        choropleth.fillAreaLayer.on('click', (event: any) => {
          const properties = event.feature?.properties
          if (properties?.name) onClickRef.current?.(properties.name, Number(properties.adcode))
        })
        choropleth.fillAreaLayer.on('mousemove', (event: any) => {
          const name = event.feature?.properties?.name
          if (name) onHoverRef.current?.(name)
        })
        choropleth.fillAreaLayer.on('unmousemove', () => onHoverRef.current?.(null))
        setReady(true)
      })
      choropleth.addToScene(scene)
      plotRef.current = choropleth

      const stationLayer = new PointLayer({ zIndex: 8 })
      stationLayer
        .source(districtItems.map(item => ({ ...item, selected: item.name === selectedDistrict })), {
          parser: { type: 'json', x: 'lng', y: 'lat' },
        })
        .shape('circle')
        .size('selected', (selected: boolean) => selected ? 10 : 7)
        .color('selected', (selected: boolean) => selected ? '#ffffff' : '#21f0a4')
        .style({ opacity: 0.95, strokeWidth: 2, stroke: '#0875a8' })
      scene.addLayer(stationLayer)
      stationLayerRef.current = stationLayer
    })

    return () => {
      plotRef.current = null
      stationLayerRef.current = null
      scene.destroy()
      sceneRef.current = null
    }
    // 城市变化时需要重建行政区数据；选择变化通过 changeData 更新，不重建场景。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.adcode])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(21,94,169,0.82)] text-[#dffbff] text-13px">
          正在加载{city.name}区县地图...
        </div>
      )}
    </div>
  )
}
