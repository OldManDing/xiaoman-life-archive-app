import { BadGatewayException, Injectable } from '@nestjs/common';

import { getMapProviderName, isStrictEnvironment } from '../../shared/env-config';
import { SearchLocationsDto } from './dto/search-locations.dto';

type LocationSuggestion = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
};

type AmapPoi = {
  id?: string;
  name?: string;
  address?: string | unknown[];
  cityname?: string;
  adname?: string;
  location?: string;
};

type AmapResponse = {
  status?: string;
  info?: string;
  pois?: AmapPoi[];
};

type AmapRegeoResponse = {
  status?: string;
  info?: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      city?: string | unknown[];
      district?: string;
      township?: string;
    };
  };
};

const commonLocations = ['家里', '小区', '公园', '学校', '医院', '游乐场', '爷爷奶奶家', '外婆家'];
const mockCoordinateAddresses = [
  { city: '上海市', district: '黄浦区', address: '上海市黄浦区人民广场附近', latitude: 31.2304, longitude: 121.4737, radiusKm: 60 },
  { city: '北京市', district: '东城区', address: '北京市东城区天安门附近', latitude: 39.9042, longitude: 116.4074, radiusKm: 70 },
  { city: '广州市', district: '天河区', address: '广州市天河区珠江新城附近', latitude: 23.1291, longitude: 113.2644, radiusKm: 60 },
  { city: '深圳市', district: '福田区', address: '深圳市福田区市民中心附近', latitude: 22.5431, longitude: 114.0579, radiusKm: 55 },
  { city: '杭州市', district: '西湖区', address: '杭州市西湖区西湖景区附近', latitude: 30.2741, longitude: 120.1551, radiusKm: 55 },
  { city: '成都市', district: '锦江区', address: '成都市锦江区春熙路附近', latitude: 30.5728, longitude: 104.0668, radiusKm: 65 },
];

const normalizeAddress = (value: string | unknown[] | undefined) => {
  if (Array.isArray(value)) return null;
  return value?.trim() || null;
};

const parseAmapLocation = (location?: string) => {
  if (!location) return { longitude: null, latitude: null };
  const [longitude, latitude] = location.split(',').map((item) => Number(item));
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return { longitude: null, latitude: null };
  }
  return { longitude, latitude };
};

const distanceKm = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

@Injectable()
export class LocationsService {
  async search(dto: SearchLocationsDto) {
    const provider = getMapProviderName();
    if (provider === 'amap') {
      return {
        provider,
        list: await this.searchAmap(dto),
      };
    }

    if (provider === 'disabled') {
      return {
        provider,
        list: [],
      };
    }

    return {
      provider,
      list: this.searchMock(dto),
    };
  }

  private searchMock(dto: Pick<SearchLocationsDto, 'keyword' | 'latitude' | 'longitude'>): LocationSuggestion[] {
    const normalized = dto.keyword.trim();
    const matched = commonLocations.filter((item) => item.includes(normalized) || normalized.includes(item));
    const list = matched.length ? matched : commonLocations.slice(0, 5);
    const suggestions = list.map((name, index) => ({
      id: `local-${index}-${name}`,
      name,
      address: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
      source: 'local',
    }));
    if (normalized.includes('附近') || normalized.includes('定位')) {
      const currentLocation = this.mockReverseGeocode(dto);
      return [
        currentLocation,
        ...suggestions,
      ];
    }
    return suggestions;
  }

  private async searchAmap(dto: SearchLocationsDto): Promise<LocationSuggestion[]> {
    const key = process.env.MAP_API_KEY?.trim();
    if (!key) {
      if (!isStrictEnvironment()) return this.searchMock(dto);
      throw new BadGatewayException('地图服务配置缺失');
    }

    const currentLocation = await this.reverseGeocodeAmap(dto, key);
    const url = new URL(process.env.MAP_AMAP_ENDPOINT ?? 'https://restapi.amap.com/v3/place/text');
    url.searchParams.set('key', key);
    url.searchParams.set('keywords', dto.keyword);
    url.searchParams.set('offset', '10');
    url.searchParams.set('page', '1');
    url.searchParams.set('extensions', 'base');
    if (dto.city) url.searchParams.set('city', dto.city);
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      url.searchParams.set('location', `${dto.longitude},${dto.latitude}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.MAP_REQUEST_TIMEOUT_MS ?? 5000));
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new BadGatewayException('地图服务请求失败');
      }

      const payload = (await response.json()) as AmapResponse;
      if (payload.status !== '1') {
        throw new BadGatewayException(`地图服务返回异常：${payload.info ?? '未知错误'}`);
      }

      const pois = (payload.pois ?? []).slice(0, 10).map((poi, index) => {
        const location = parseAmapLocation(poi.location);
        return {
          id: poi.id || `amap-${index}`,
          name: poi.name?.trim() || dto.keyword,
          address: normalizeAddress(poi.address),
          city: poi.cityname?.trim() || null,
          district: poi.adname?.trim() || null,
          latitude: location.latitude,
          longitude: location.longitude,
          source: 'amap',
        };
      });
      return currentLocation ? [currentLocation, ...pois.filter((poi) => poi.name !== currentLocation.name)] : pois;
    } catch (error) {
      if (!isStrictEnvironment()) return this.searchMock(dto);
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('地图服务暂时不可用');
    } finally {
      clearTimeout(timeout);
    }
  }

  private mockReverseGeocode(dto: Pick<SearchLocationsDto, 'latitude' | 'longitude'>): LocationSuggestion {
    const latitude = dto.latitude;
    const longitude = dto.longitude;
    if (latitude === undefined || longitude === undefined) {
      return {
        id: 'local-current-location',
        name: '当前位置',
        address: null,
        city: null,
        district: null,
        latitude: null,
        longitude: null,
        source: 'local',
      };
    }

    const coordinate = { latitude, longitude };
    const nearest = mockCoordinateAddresses
      .map((item) => ({ item, distance: distanceKm(coordinate, item) }))
      .sort((left, right) => left.distance - right.distance)[0];
    const matched = nearest && nearest.distance <= nearest.item.radiusKm ? nearest.item : null;
    const address = matched?.address ?? '当前位置附近';

    return {
      id: 'local-current-address',
      name: address,
      address,
      city: matched?.city ?? null,
      district: matched?.district ?? null,
      latitude,
      longitude,
      source: 'mock-regeo',
    };
  }

  private async reverseGeocodeAmap(dto: SearchLocationsDto, key: string): Promise<LocationSuggestion | null> {
    if (dto.latitude === undefined || dto.longitude === undefined) return null;

    const url = new URL(process.env.MAP_AMAP_REGEOCODE_ENDPOINT ?? 'https://restapi.amap.com/v3/geocode/regeo');
    url.searchParams.set('key', key);
    url.searchParams.set('location', `${dto.longitude},${dto.latitude}`);
    url.searchParams.set('extensions', 'base');
    url.searchParams.set('radius', '1000');
    url.searchParams.set('roadlevel', '0');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.MAP_REQUEST_TIMEOUT_MS ?? 5000));
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;

      const payload = (await response.json()) as AmapRegeoResponse;
      if (payload.status !== '1') return null;

      const address = payload.regeocode?.formatted_address?.trim();
      if (!address) return null;

      const component = payload.regeocode?.addressComponent;
      const city = Array.isArray(component?.city) ? null : component?.city?.trim() || null;
      return {
        id: 'amap-current-address',
        name: address,
        address,
        city,
        district: component?.district?.trim() || null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source: 'amap-regeo',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
