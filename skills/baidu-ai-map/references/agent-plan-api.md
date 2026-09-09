# Agent Plan API 参考

所有接口使用 `https://api.map.baidu.com`，通过请求头 `Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN` 鉴权。查询参数使用 `curl --get` 与 `--data-urlencode`，避免手工拼接 URL。

## 目录

- [Place](#place)
- [Direction](#direction)
- [Geocoding](#geocoding)
- [Reverse Geocoding](#reverse-geocoding)
- [Weather](#weather)

## Place

`GET /agent_plan/v1/place`

必填参数：

- `user_raw_request`：完整保留用户原始需求和约束词，不压缩成关键词。
- `region`：城市或区域限制。

可选参数：

- `center`：检索中心和排序参考点，格式为 `lat,lng`，坐标系为 gcj02。
- `sort`：`distance` 或 `relevance`，默认为 `relevance`。

使用 `sort=distance` 时必须传 `center`。坐标必须来自用户或可信接口结果，不得推测；经纬度至少保留 6 位小数。

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/place" \
  -H "Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN" \
  --data-urlencode "user_raw_request=离我最近的火锅店" \
  --data-urlencode "region=北京市" \
  --data-urlencode "center=40.056800,116.308300" \
  --data-urlencode "sort=distance"
```

## Direction

`GET /agent_plan/v1/direction`

必填参数：

- `user_raw_request`：包含起终点并保留完整路线约束。接口仅支持驾车、步行、骑行、公交，其他交通方式需改写为其中一种。
- `location`：用户当前位置，格式为 `lat,lng`，坐标系为 gcj02；用于推理模糊或同名起点。

可选参数：

- `refer_pois`：地点精确映射，格式为 `地点名称:uid,纬度,经度;地点名称:uid,纬度,经度`。仅在明确存在同名地点或别名消歧时传入。

`location` 与 `refer_pois` 的坐标必须来自用户或可信接口结果，经纬度至少保留 6 位小数。响应可能是路线，也可能是起终点候选；无法根据用户需求唯一消歧时，再请用户选择。

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/direction" \
  -H "Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN" \
  --data-urlencode "user_raw_request=从故宫驾车到颐和园" \
  --data-urlencode "location=39.914590,116.403770"
```

别名需要精确映射时：

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/direction" \
  -H "Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN" \
  --data-urlencode "user_raw_request=步行去我家附近最近的中餐厅" \
  --data-urlencode "location=40.056800,116.308300" \
  --data-urlencode "refer_pois=我家:fbc88a21464370106e3e1b52,40.092180,116.345310"
```

## Geocoding

`GET /agent_plan/v1/geocoding`

- 必填 `address`：尽量完整的地址。
- 可选 `region`：城市或区域提示，用于减少歧义。

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/geocoding" \
  -H "Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN" \
  --data-urlencode "address=北京市海淀区上地十街10号百度大厦" \
  --data-urlencode "region=北京市"
```

## Reverse Geocoding

`GET /agent_plan/v1/reverse_geocoding`

必填 `location`，格式为 `lat,lng`，坐标系为 gcj02，经纬度至少保留 6 位小数。

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/reverse_geocoding" \
  -H "Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN" \
  --data-urlencode "location=40.056800,116.308300"
```

## Weather

`GET /agent_plan/v1/weather`

- `region`：行政区划名称。
- `location`：`lat,lng` 格式的 gcj02 坐标。

两者至少传一个。传坐标时，经纬度至少保留 6 位小数。

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/weather" \
  -H "Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN" \
  --data-urlencode "region=北京市"
```
