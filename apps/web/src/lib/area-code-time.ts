/**
 * Their local time, inferred from a North American area code.
 *
 * Worth knowing before you send: the single most common way to be rude by text
 * is to arrive at 3am. No API call, no stored timezone, no setup — the number
 * is already in the database.
 *
 * Deliberately incomplete and deliberately honest about it. An unknown area
 * code returns null and the UI shows nothing, because a confidently wrong
 * local time is worse than no local time: it would be used to decide whether
 * to send.
 */

/** Area code → IANA zone. Only codes we are confident about. */
const AREA_CODE_ZONE: Record<string, string> = {};

function assign(zone: string, codes: string[]) {
  for (const c of codes) AREA_CODE_ZONE[c] = zone;
}

// Pacific
assign('America/Los_Angeles', [
  '206','209','213','253','279','310','323','341','350','360','369','408','415','424','425','442',
  '458','503','509','510','530','541','559','562','564','619','626','628','650','657','661','669',
  '702','707','714','725','747','760','775','805','818','820','831','837','840','858','909','916',
  '925','949','951','971',
]);

// Mountain
assign('America/Denver', [
  '208','303','307','385','406','435','505','575','719','720','801','970','986',
]);
// Arizona does not observe DST, so it needs its own zone rather than Denver's.
assign('America/Phoenix', ['480', '520', '602', '623', '928']);

// Central
assign('America/Chicago', [
  '205','210','214','218','224','225','251','256','262','270','281','309','312','314','316','318',
  '319','320','325','326','331','334','337','346','351','361','363','364','402','405','409','414',
  '417','430','432','435','469','479','501','502','504','507','512','515','531','534','538','563',
  '570','573','580','601','605','606','608','612','615','618','620','630','636','641','651','660',
  '662','667','681','682','708','712','713','715','726','737','763','769','773','779','785','806',
  '815','816','830','832','847','850','870','872','901','903','913','915','918','920','931','936',
  '940','956','972','979','985',
]);

// Eastern
assign('America/New_York', [
  '201','202','203','207','212','215','216','220','223','229','231','234','239','240','248','267',
  '272','276','301','302','304','305','313','315','321','323','330','332','336','339','347','351',
  '352','380','386','401','404','407','410','412','413','419','423','434','440','443','445','470',
  '475','478','484','508','513','516','517','518','540','551','561','567','571','585','586','603',
  '607','609','610','614','617','631','646','667','678','680','689','703','704','706','716','717',
  '718','724','727','732','734','740','743','754','757','762','770','772','774','781','786','803',
  '804','810','813','814','828','838','839','843','845','848','856','857','859','860','862','863',
  '864','865','878','904','908','910','912','914','917','919','929','930','937','941','947','954',
  '959','973','978','980','984','986','989',
]);

// Alaska and Hawaii
assign('America/Anchorage', ['907']);
assign('Pacific/Honolulu', ['808']);

/** The IANA zone for a phone number, or null when we cannot tell. */
export function zoneForAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const digits = address.replace(/\D/g, '');
  // Only North American numbers: 10 digits, or 11 starting with the country
  // code. Anything else and the leading digits are not an area code at all.
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return AREA_CODE_ZONE[local.slice(0, 3)] ?? null;
}

export interface LocalTime {
  /** e.g. "9:14 PM" */
  time: string;
  /** True when it is a rude hour to text — before 8am or after 9pm. */
  unsociable: boolean;
}

/** Their wall-clock time right now, or null if the zone is unknown. */
export function localTimeForAddress(
  address: string | null | undefined,
  now: Date = new Date(),
): LocalTime | null {
  const zone = zoneForAddress(address);
  if (!zone) return null;

  try {
    const time = now.toLocaleTimeString('en-US', {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
    });
    const hour = Number(
      now.toLocaleString('en-US', { timeZone: zone, hour: 'numeric', hour12: false }),
    );
    return { time, unsociable: hour < 8 || hour >= 21 };
  } catch {
    // An unknown zone name at runtime is not worth throwing over.
    return null;
  }
}
