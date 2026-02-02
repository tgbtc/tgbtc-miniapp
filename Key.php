<?php
// Key.php
header('Content-Type: application/json; charset=utf-8');

// === НАСТРОЙКИ ===
$JETTON_MASTER = "kQCxINuwGtspAnynQHKcnhVr2GweYkRZsbKNW0XtaHOAdAAR";
$API_KEY = "c3ba09c48a9c56da900cad1f1153e9314f737343dea919449cea5a8e7254e1a6";

// TON Center testnet endpoint (v2)
$url = "https://testnet.toncenter.com/api/v2/getTokenData?address=" . urlencode($JETTON_MASTER);

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 12,
  CURLOPT_HTTPHEADER => [
    "Accept: application/json",
    "X-API-Key: $API_KEY",
  ],
]);

$resp = curl_exec($ch);
$err  = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($resp === false) {
  http_response_code(500);
  echo json_encode(["ok"=>false, "error"=>"curl_error: ".$err], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($code < 200 || $code >= 300) {
  http_response_code(502);
  echo json_encode([
    "ok"=>false,
    "error"=>"toncenter_http_$code",
    "raw"=>$resp
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// Возвращаем как есть (TON Center уже отдаёт JSON: { ok: true/false, result: ... })
echo $resp;
