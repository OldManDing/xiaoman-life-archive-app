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

const commonLocations = ['家里', '小区', '公园', '学校', '医院', '游乐场', '爷爷奶奶家', '外婆家'];

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

    return {
      provider,
      list: this.searchMock(dto.keyword),
    };
  }

  private searchMock(keyword: string): LocationSuggestion[] {
    const normalized = keyword.trim();
    const matched = commonLocations.filter((item) => item.includes(normalized) || normalized.includes(item));
    const list = matched.length ? matched : commonLocations.slice(0, 5);
    return list.map((name, index) => ({
      id: `local-${index}-${name}`,
      name,
      address: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null,
      source: 'local',
    }));
  }

  private async searchAmap(dto: SearchLocationsDto): Promise<LocationSuggestion[]> {
    const key = process.env.MAP_API_KEY?.trim();
    if (!key) {
      if (!isStrictEnvironment()) return this.searchMock(dto.keyword);
      throw new BadGatewayException('地图服务配置缺失');
    }

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

      return (payload.pois ?? []).slice(0, 10).map((poi, index) => {
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
    } catch (error) {
      if (!isStrictEnvironment()) return this.searchMock(dto.keyword);
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('地图服务暂时不可用');
    } finally {
      clearTimeout(timeout);
    }
  }
}
