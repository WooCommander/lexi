import { describe, expect, it } from 'vitest'
import { compareVersions } from './semver'

describe('compareVersions', () => {
    it('compares numerically, not lexically', () => {
        expect(compareVersions('1.10.0', '1.9.9')).toBe(1)
        expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
        expect(compareVersions('2.0', '2.0.0')).toBe(0)
    })
})
