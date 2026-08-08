import { describe, it, expect } from 'vitest';
import { classifyCorrespondent, extractOtpCode } from '../src/correspondent.js';

describe('extractOtpCode', () => {
  it('pulls the code out of real verification messages', () => {
    expect(extractOtpCode('Your verification code is 402931')).toBe('402931');
    expect(extractOtpCode('123456 is your Acme login code. Do not share it.')).toBe('123456');
    expect(extractOtpCode('G-558103 is your Google verification code')).toBe('G-558103');
    expect(extractOtpCode('Use passcode 8891 to sign in')).toBe('8891');
  });

  it('picks the code next to the keyword, not the first number it sees', () => {
    expect(
      extractOtpCode('Your verification code is 402931, valid for 10 minutes'),
    ).toBe('402931');
  });

  it('ignores numbers that are not codes', () => {
    expect(extractOtpCode('Your order 88213 has shipped')).toBeNull();
    expect(extractOtpCode('See you at 1430 Oak Street')).toBeNull();
    expect(extractOtpCode('Can you send $2500 today?')).toBeNull();
    expect(extractOtpCode('call me')).toBeNull();
    expect(extractOtpCode(null)).toBeNull();
  });

  it('refuses a bare 4-digit token buried in a long message', () => {
    const long = `Your security code matters to us. ${'We take this seriously. '.repeat(6)}1234`;
    expect(extractOtpCode(long)).toBeNull();
  });
});

describe('classifyCorrespondent', () => {
  it('calls a fresh code notification an otp thread', () => {
    expect(
      classifyCorrespondent({
        address: '272316',
        inboundBodies: ['847302 is your verification code'],
      }),
    ).toBe('otp');
  });

  it('calls short codes and no-reply traffic automated', () => {
    expect(classifyCorrespondent({ address: '44398', inboundBodies: ['Your package arrives today'] })).toBe(
      'automated',
    );
    expect(
      classifyCorrespondent({
        address: '+15551234567',
        inboundBodies: ['Your appointment is confirmed. Do not reply to this message.'],
      }),
    ).toBe('automated');
  });

  it('never demotes someone we know or have answered', () => {
    // A named contact is a person even if their message looks automated.
    expect(
      classifyCorrespondent({
        address: '44398',
        hasContactName: true,
        inboundBodies: ['Your order has shipped'],
      }),
    ).toBe('person');
    // We replied, so it's a conversation.
    expect(
      classifyCorrespondent({
        address: '272316',
        hasOutbound: true,
        inboundBodies: ['847302 is your verification code'],
      }),
    ).toBe('person');
    // Groups are always people.
    expect(
      classifyCorrespondent({ isGroup: true, inboundBodies: ['do not reply'] }),
    ).toBe('person');
  });

  it('leaves a plain new number as unknown', () => {
    expect(
      classifyCorrespondent({ address: '+15551234567', inboundBodies: ['Hey, are you around?'] }),
    ).toBe('unknown');
    expect(classifyCorrespondent({})).toBe('unknown');
  });

  it('promotes an otp number the moment a human uses it', () => {
    const asCode = classifyCorrespondent({
      address: '+15551234567',
      inboundBodies: ['552310 is your code'],
    });
    // Newest message first: a real message today outranks codes from before.
    const asPerson = classifyCorrespondent({
      address: '+15551234567',
      inboundBodies: ['Hi, is this the support line?', '552310 is your code'],
    });
    expect(asCode).toBe('otp');
    expect(asPerson).toBe('unknown');
  });
});
