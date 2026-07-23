export interface CityItem {
  name: string
  adcode: string
  lng: number
  lat: number
  bg?: string
}

export const provinces = [
  { adcode: '330000', name: '浙江省' },
]

export const cities: CityItem[] = [
  { name: '杭州市', adcode: '330100', lng: 120.153576, lat: 30.287459, bg: '#5584bf' },
  { name: '宁波市', adcode: '330200', lng: 121.549792, lat: 29.868388, bg: '#3667a4' },
  { name: '温州市', adcode: '330300', lng: 120.672111, lat: 28.000575, bg: '#4784bf' },
  { name: '嘉兴市', adcode: '330400', lng: 120.750865, lat: 30.762653, bg: '#5d93d7' },
  { name: '湖州市', adcode: '330500', lng: 120.102398, lat: 30.867198, bg: '#5584bf' },
  { name: '绍兴市', adcode: '330600', lng: 120.582114, lat: 29.997117, bg: '#3667a4' },
  { name: '金华市', adcode: '330700', lng: 119.649506, lat: 29.089524, bg: '#4784bf' },
  { name: '衢州市', adcode: '330800', lng: 118.87263, lat: 28.941708, bg: '#5d93d7' },
  { name: '舟山市', adcode: '330900', lng: 122.106863, lat: 30.016028, bg: '#5584bf' },
  { name: '台州市', adcode: '331000', lng: 121.428599, lat: 28.661378, bg: '#3667a4' },
  { name: '丽水市', adcode: '331100', lng: 119.921786, lat: 28.451993, bg: '#4784bf' },
]

export const hangzhouDistricts = [
  { name: '西湖区', adcode: '330106' },
  { name: '上城区', adcode: '330102' },
  { name: '拱墅区', adcode: '330105' },
  { name: '滨江区', adcode: '330108' },
  { name: '萧山区', adcode: '330109' },
  { name: '余杭区', adcode: '330110' },
  { name: '临平区', adcode: '330111' },
  { name: '钱塘区', adcode: '330112' },
  { name: '富阳区', adcode: '330113' },
  { name: '临安区', adcode: '330114' },
]

export interface DistrictItem {
  name: string
  level: string
  adcode: number
  lng: number
  lat: number
  childrenNum: number
  parent: number
}

export const districts = [
    {
        name: '上城区',
        level: 'district',
        adcode: 330102,
        lng: 120.19732,
        lat: 30.226543,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '拱墅区',
        level: 'district',
        adcode: 330105,
        lng: 120.141503,
        lat: 30.319126,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '西湖区',
        level: 'district',
        adcode: 330106,
        lng: 120.130396,
        lat: 30.259242,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '滨江区',
        level: 'district',
        adcode: 330108,
        lng: 120.211981,
        lat: 30.208332,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '萧山区',
        level: 'district',
        adcode: 330109,
        lng: 120.264263,
        lat: 30.184119,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '余杭区',
        level: 'district',
        adcode: 330110,
        lng: 119.978742,
        lat: 30.273705,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '富阳区',
        level: 'district',
        adcode: 330111,
        lng: 119.96022,
        lat: 30.048803,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '临安区',
        level: 'district',
        adcode: 330112,
        lng: 119.724457,
        lat: 30.234375,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '临平区',
        level: 'district',
        adcode: 330113,
        lng: 120.299222,
        lat: 30.419154,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '钱塘区',
        level: 'district',
        adcode: 330114,
        lng: 120.493941,
        lat: 30.32304,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '桐庐县',
        level: 'district',
        adcode: 330122,
        lng: 119.691755,
        lat: 29.79418,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '淳安县',
        level: 'district',
        adcode: 330127,
        lng: 119.042015,
        lat: 29.609678,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '建德市',
        level: 'district',
        adcode: 330182,
        lng: 119.281195,
        lat: 29.474964,
        childrenNum: 0,
        parent: 330100
    },
    {
        name: '海曙区',
        level: 'district',
        adcode: 330203,
        lng: 121.550485,
        lat: 29.873705,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '江北区',
        level: 'district',
        adcode: 330205,
        lng: 121.555067,
        lat: 29.88673,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '北仑区',
        level: 'district',
        adcode: 330206,
        lng: 121.844601,
        lat: 29.899548,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '镇海区',
        level: 'district',
        adcode: 330211,
        lng: 121.596686,
        lat: 29.965212,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '鄞州区',
        level: 'district',
        adcode: 330212,
        lng: 121.546617,
        lat: 29.817302,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '奉化区',
        level: 'district',
        adcode: 330213,
        lng: 121.406151,
        lat: 29.655292,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '象山县',
        level: 'district',
        adcode: 330225,
        lng: 121.869251,
        lat: 29.476826,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '宁海县',
        level: 'district',
        adcode: 330226,
        lng: 121.429729,
        lat: 29.287929,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '余姚市',
        level: 'district',
        adcode: 330281,
        lng: 121.154572,
        lat: 30.037967,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '慈溪市',
        level: 'district',
        adcode: 330282,
        lng: 121.266525,
        lat: 30.170695,
        childrenNum: 0,
        parent: 330200
    },
    {
        name: '鹿城区',
        level: 'district',
        adcode: 330302,
        lng: 120.655199,
        lat: 28.015776,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '龙湾区',
        level: 'district',
        adcode: 330303,
        lng: 120.812333,
        lat: 27.933261,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '瓯海区',
        level: 'district',
        adcode: 330304,
        lng: 120.615149,
        lat: 27.967445,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '洞头区',
        level: 'district',
        adcode: 330305,
        lng: 121.157406,
        lat: 27.836412,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '永嘉县',
        level: 'district',
        adcode: 330324,
        lng: 120.69136,
        lat: 28.153914,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '平阳县',
        level: 'district',
        adcode: 330326,
        lng: 120.565161,
        lat: 27.662394,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '苍南县',
        level: 'district',
        adcode: 330327,
        lng: 120.425957,
        lat: 27.518636,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '文成县',
        level: 'district',
        adcode: 330328,
        lng: 120.090929,
        lat: 27.786856,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '泰顺县',
        level: 'district',
        adcode: 330329,
        lng: 119.717643,
        lat: 27.556578,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '瑞安市',
        level: 'district',
        adcode: 330381,
        lng: 120.655245,
        lat: 27.778967,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '乐清市',
        level: 'district',
        adcode: 330382,
        lng: 120.986297,
        lat: 28.112519,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '龙港市',
        level: 'district',
        adcode: 330383,
        lng: 120.552952,
        lat: 27.578379,
        childrenNum: 0,
        parent: 330300
    },
    {
        name: '南湖区',
        level: 'district',
        adcode: 330402,
        lng: 120.782952,
        lat: 30.747738,
        childrenNum: 0,
        parent: 330400
    },
    {
        name: '秀洲区',
        level: 'district',
        adcode: 330411,
        lng: 120.709047,
        lat: 30.764811,
        childrenNum: 0,
        parent: 330400
    },
    {
        name: '嘉善县',
        level: 'district',
        adcode: 330421,
        lng: 120.926031,
        lat: 30.83085,
        childrenNum: 0,
        parent: 330400
    },
    {
        name: '海盐县',
        level: 'district',
        adcode: 330424,
        lng: 120.94628,
        lat: 30.52664,
        childrenNum: 0,
        parent: 330400
    },
    {
        name: '海宁市',
        level: 'district',
        adcode: 330481,
        lng: 120.680224,
        lat: 30.511536,
        childrenNum: 0,
        parent: 330400
    },
    {
        name: '平湖市',
        level: 'district',
        adcode: 330482,
        lng: 121.015619,
        lat: 30.677804,
        childrenNum: 0,
        parent: 330400
    },
    {
        name: '桐乡市',
        level: 'district',
        adcode: 330483,
        lng: 120.565127,
        lat: 30.630375,
        childrenNum: 0,
        parent: 330400
    },
    {
        name: '吴兴区',
        level: 'district',
        adcode: 330502,
        lng: 120.185608,
        lat: 30.857184,
        childrenNum: 0,
        parent: 330500
    },
    {
        name: '南浔区',
        level: 'district',
        adcode: 330503,
        lng: 120.418244,
        lat: 30.850835,
        childrenNum: 0,
        parent: 330500
    },
    {
        name: '德清县',
        level: 'district',
        adcode: 330521,
        lng: 119.9774,
        lat: 30.54251,
        childrenNum: 0,
        parent: 330500
    },
    {
        name: '长兴县',
        level: 'district',
        adcode: 330522,
        lng: 119.911212,
        lat: 31.026962,
        childrenNum: 0,
        parent: 330500
    },
    {
        name: '安吉县',
        level: 'district',
        adcode: 330523,
        lng: 119.680261,
        lat: 30.638803,
        childrenNum: 0,
        parent: 330500
    },
    {
        name: '越城区',
        level: 'district',
        adcode: 330602,
        lng: 120.582338,
        lat: 29.989092,
        childrenNum: 0,
        parent: 330600
    },
    {
        name: '柯桥区',
        level: 'district',
        adcode: 330603,
        lng: 120.495532,
        lat: 30.083039,
        childrenNum: 0,
        parent: 330600
    },
    {
        name: '上虞区',
        level: 'district',
        adcode: 330604,
        lng: 120.868571,
        lat: 30.033862,
        childrenNum: 0,
        parent: 330600
    },
    {
        name: '新昌县',
        level: 'district',
        adcode: 330624,
        lng: 120.903918,
        lat: 29.500525,
        childrenNum: 0,
        parent: 330600
    },
    {
        name: '诸暨市',
        level: 'district',
        adcode: 330681,
        lng: 120.246602,
        lat: 29.709398,
        childrenNum: 0,
        parent: 330600
    },
    {
        name: '嵊州市',
        level: 'district',
        adcode: 330683,
        lng: 120.830505,
        lat: 29.561519,
        childrenNum: 0,
        parent: 330600
    },
    {
        name: '婺城区',
        level: 'district',
        adcode: 330702,
        lng: 119.571574,
        lat: 29.087311,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '金东区',
        level: 'district',
        adcode: 330703,
        lng: 119.692821,
        lat: 29.099822,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '武义县',
        level: 'district',
        adcode: 330723,
        lng: 119.816341,
        lat: 28.892562,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '浦江县',
        level: 'district',
        adcode: 330726,
        lng: 119.89259,
        lat: 29.453363,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '磐安县',
        level: 'district',
        adcode: 330727,
        lng: 120.449937,
        lat: 29.054491,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '兰溪市',
        level: 'district',
        adcode: 330781,
        lng: 119.460404,
        lat: 29.209059,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '义乌市',
        level: 'district',
        adcode: 330782,
        lng: 120.075679,
        lat: 29.306296,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '东阳市',
        level: 'district',
        adcode: 330783,
        lng: 120.24179,
        lat: 29.290158,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '永康市',
        level: 'district',
        adcode: 330784,
        lng: 120.047356,
        lat: 28.88899,
        childrenNum: 0,
        parent: 330700
    },
    {
        name: '柯城区',
        level: 'district',
        adcode: 330802,
        lng: 118.874138,
        lat: 28.936937,
        childrenNum: 0,
        parent: 330800
    },
    {
        name: '衢江区',
        level: 'district',
        adcode: 330803,
        lng: 118.959139,
        lat: 28.980356,
        childrenNum: 0,
        parent: 330800
    },
    {
        name: '常山县',
        level: 'district',
        adcode: 330822,
        lng: 118.511224,
        lat: 28.902446,
        childrenNum: 0,
        parent: 330800
    },
    {
        name: '开化县',
        level: 'district',
        adcode: 330824,
        lng: 118.415756,
        lat: 29.136729,
        childrenNum: 0,
        parent: 330800
    },
    {
        name: '龙游县',
        level: 'district',
        adcode: 330825,
        lng: 119.1723,
        lat: 29.028214,
        childrenNum: 0,
        parent: 330800
    },
    {
        name: '江山市',
        level: 'district',
        adcode: 330881,
        lng: 118.627228,
        lat: 28.73796,
        childrenNum: 0,
        parent: 330800
    },
    {
        name: '定海区',
        level: 'district',
        adcode: 330902,
        lng: 122.106844,
        lat: 30.019795,
        childrenNum: 0,
        parent: 330900
    },
    {
        name: '普陀区',
        level: 'district',
        adcode: 330903,
        lng: 122.323297,
        lat: 29.970571,
        childrenNum: 0,
        parent: 330900
    },
    {
        name: '岱山县',
        level: 'district',
        adcode: 330921,
        lng: 122.225718,
        lat: 30.264533,
        childrenNum: 0,
        parent: 330900
    },
    {
        name: '嵊泗县',
        level: 'district',
        adcode: 330922,
        lng: 122.45132,
        lat: 30.725677,
        childrenNum: 0,
        parent: 330900
    },
    {
        name: '椒江区',
        level: 'district',
        adcode: 331002,
        lng: 121.442859,
        lat: 28.673334,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '黄岩区',
        level: 'district',
        adcode: 331003,
        lng: 121.261804,
        lat: 28.649433,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '路桥区',
        level: 'district',
        adcode: 331004,
        lng: 121.337874,
        lat: 28.578244,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '三门县',
        level: 'district',
        adcode: 331022,
        lng: 121.39561,
        lat: 29.104888,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '天台县',
        level: 'district',
        adcode: 331023,
        lng: 121.006657,
        lat: 29.144594,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '仙居县',
        level: 'district',
        adcode: 331024,
        lng: 120.728733,
        lat: 28.846856,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '温岭市',
        level: 'district',
        adcode: 331081,
        lng: 121.385435,
        lat: 28.372805,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '临海市',
        level: 'district',
        adcode: 331082,
        lng: 121.144625,
        lat: 28.859042,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '玉环市',
        level: 'district',
        adcode: 331083,
        lng: 121.231915,
        lat: 28.136703,
        childrenNum: 0,
        parent: 331000
    },
    {
        name: '莲都区',
        level: 'district',
        adcode: 331102,
        lng: 119.912266,
        lat: 28.4461,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '青田县',
        level: 'district',
        adcode: 331121,
        lng: 120.289693,
        lat: 28.1396,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '缙云县',
        level: 'district',
        adcode: 331122,
        lng: 120.091685,
        lat: 28.659294,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '遂昌县',
        level: 'district',
        adcode: 331123,
        lng: 119.275865,
        lat: 28.592388,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '松阳县',
        level: 'district',
        adcode: 331124,
        lng: 119.481406,
        lat: 28.448883,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '云和县',
        level: 'district',
        adcode: 331125,
        lng: 119.573454,
        lat: 28.116024,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '庆元县',
        level: 'district',
        adcode: 331126,
        lng: 119.062572,
        lat: 27.619213,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '景宁畲族自治县',
        level: 'district',
        adcode: 331127,
        lng: 119.635686,
        lat: 27.973594,
        childrenNum: 0,
        parent: 331100
    },
    {
        name: '龙泉市',
        level: 'district',
        adcode: 331181,
        lng: 119.14126,
        lat: 28.074916,
        childrenNum: 0,
        parent: 331100
    }
]
