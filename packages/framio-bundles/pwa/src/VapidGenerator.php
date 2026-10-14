<?php

/*
 * This file is part of framio/pwa
 *
 * Copyright (c) 2026 Framio-Dev
 * https://dev.framiomedia.com
 */

namespace Framio\PWA;

use Base64Url\Base64Url;
use ErrorException;
use Jose\Component\Core\JWK;
use Jose\Component\Core\Util\ECKey;
use Minishlink\WebPush\Utils;
use Minishlink\WebPush\VAPID;

class VapidGenerator
{
    /**
     * Generate VAPID key pair ensuring OpenSSL config is properly resolved on all platforms (including Windows/XAMPP).
     *
     * @return array{publicKey: string, privateKey: string}
     * @throws ErrorException
     */
    public static function generate(): array
    {
        // Try standard VAPID first
        try {
            return VAPID::createVapidKeys();
        } catch (\Throwable $e) {
            // Check common OpenSSL config paths on Windows
            $opensslConfigPaths = [
                'C:/xampp/apache/conf/openssl.cnf',
                'C:/xampp/php/extras/ssl/openssl.cnf',
                getenv('OPENSSL_CONF') ?: '',
            ];

            $validConfig = null;
            foreach ($opensslConfigPaths as $path) {
                if (!empty($path) && file_exists($path)) {
                    $validConfig = $path;
                    break;
                }
            }

            if (!$validConfig) {
                throw new ErrorException('Unable to create VAPID keys: OpenSSL configuration file (openssl.cnf) not found.');
            }

            $key = openssl_pkey_new([
                'curve_name' => 'prime256v1',
                'private_key_type' => OPENSSL_KEYTYPE_EC,
                'config' => $validConfig,
            ]);

            if ($key === false) {
                throw new ErrorException('Unable to create OpenSSL EC key.');
            }

            $exported = openssl_pkey_export($key, $out, null, ['config' => $validConfig]);
            if ($exported === false) {
                throw new ErrorException('Unable to export OpenSSL EC key.');
            }

            $res = openssl_pkey_get_private($out);
            if ($res === false) {
                throw new ErrorException('Unable to read private EC key.');
            }

            $details = openssl_pkey_get_details($res);
            if ($details === false || empty($details['ec'])) {
                throw new ErrorException('Unable to get EC key details.');
            }

            $curveSize = 256;
            $d = str_pad((string) $details['ec']['d'], (int) ceil($curveSize / 8), "\0", STR_PAD_LEFT);
            $x = str_pad((string) $details['ec']['x'], (int) ceil($curveSize / 8), "\0", STR_PAD_LEFT);
            $y = str_pad((string) $details['ec']['y'], (int) ceil($curveSize / 8), "\0", STR_PAD_LEFT);

            $jwk = new JWK([
                'kty' => 'EC',
                'crv' => 'P-256',
                'd' => Base64Url::encode($d),
                'x' => Base64Url::encode($x),
                'y' => Base64Url::encode($y),
            ]);

            $binaryPublicKey = hex2bin(Utils::serializePublicKeyFromJWK($jwk));
            if (!$binaryPublicKey) {
                throw new ErrorException('Failed to convert VAPID public key from hexadecimal to binary.');
            }

            $binaryPrivateKey = hex2bin(str_pad(bin2hex(Base64Url::decode($jwk->get('d'))), 64, '0', STR_PAD_LEFT));
            if (!$binaryPrivateKey) {
                throw new ErrorException('Failed to convert VAPID private key from hexadecimal to binary.');
            }

            return [
                'publicKey'  => Base64Url::encode($binaryPublicKey),
                'privateKey' => Base64Url::encode($binaryPrivateKey),
            ];
        }
    }
}
