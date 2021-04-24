const BaseAccessory = require('./BaseAccessory');

const STATE_OTHER = 9;

class Dehumidifier2Accessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.DEHUMIDIFIER;
    }

    constructor(...props) {
        super(...props);

        this.defaultDps = {
            'Active':     1,
            'Mode':       2,  // Low/Fan/Auto/High
            'CurrentHumidity':   3,
            'Humidity': 4,
            'Plasma':   5,
            'UV':   10, 
            'Light': 101,
            'Oscillation': 102,
            'CurrentTemperature': 103,
        }
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;

        this.accessory.addService(Service.HumidifierDehumidifier, this.device.context.name);
        this.accessory.addService(Service.Fan, this.device.context.name);
        this.accessory.addService(Service.TemperatureSensor, this.device.context.name);
        this.accessory.addService(Service.HumiditySensor, this.device.context.name);

        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;

        const infoService = this.accessory.getService(Service.AccessoryInformation);
        infoService.getCharacteristic(Characteristic.Manufacturer).updateValue(this.device.context.manufacturer);
        infoService.getCharacteristic(Characteristic.Model).updateValue(this.device.context.model);

        const characteristicTemperature = this.accessory.getService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .updateValue(this._getCurrentTemperature(dps[this.getDp('CurrentTemperature')]))
            .on('get', this.getCurrentTemperature.bind(this));

        const characteristicCurrentHumidity = this.accessory.getService(Service.HumiditySensor)
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .updateValue(this._getCurrentHumidity(dps[this.getDp('CurrentHumidity')]))
            .on('get', this.getCurrentHumidity.bind(this));

        const service = this.accessory.getService(Service.HumidifierDehumidifier);
        this._checkServiceName(service, this.device.context.name);

        const fanService = this.accessory.getService(Service.Fan);
        this._checkServiceName(fanService, this.device.context.name);

        service.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState)
            .updateValue(Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING);
        service.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
            .updateValue(Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER);

        const characteristicCurrentHumidity2 = service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .updateValue(this._getCurrentHumidity(dps[this.getDp('CurrentHumidity')]))
            .on('get', this.getCurrentHumidity.bind(this));

        const characteristicFanActive = fanService.getCharacteristic(Characteristic.On)
            .updateValue(this._getFanActive(dps[this.getDp('Mode')]))
            .on('get', this.getFanActive.bind(this))
            .on('set', this.setFanActive.bind(this));

        const characteristicActive = service.getCharacteristic(Characteristic.Active)
            .updateValue(this._getActive(dps[this.getDp('Active')]))
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

        this.characteristicHumidity = service.getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold);
        this.characteristicHumidity.setProps({
                minStep: 5,
            })
            .updateValue(dps[this.getDp('Humidity')])
            .on('get', this.getState.bind(this, this.getDp('Humidity')))
            .on('set', this.setTargetHumidity.bind(this));

        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.getDp('Active'))) {
                const newActive = this._getActive(changes[this.getDp('Active')]);
                if (characteristicActive.value !== newActive) {
                    characteristicActive.updateValue(newActive);
                }

                if (!characteristicActive.value) {
                	  characteristicFanActive.updateValue(newActive); 
                    this.setState(this.getDp('Mode'), 'low', function(callback) {
                        console.log('Reset mode on off');
                    });
                }
            }

            // Only allow dehumidifier to operate in "low" and "high" modes
            if (changes.hasOwnProperty(this.getDp('Mode'))) {
                let mode = changes[this.getDp('Mode')];
                if(['auto', 'fan'].includes(mode)) {
                    this.setState(this.getDp('Mode'), 'high', function(callback) {
                        console.log('Reset illegal mode', mode);
                    });
                }
            }

            if (changes.hasOwnProperty('Humidity') && this.characteristicHumidity.value !== changes[this.getDp('Humidity')]) this.characteristicHumidity.updateValue(changes[this.getDp('Humidity')]);

        });
    }

    getActive(callback) {
        this.getState(this.getDp('Active'), (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getActive(dp));
        });
    }

    _getActive(dp) {
        const {Characteristic} = this.hap;

        return dp ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
    }

    setActive(value, callback) {
        const {Characteristic} = this.hap;

        switch (value) {
            case Characteristic.Active.ACTIVE:
                return this.setState(this.getDp('Active'), true, callback);

            case Characteristic.Active.INACTIVE:
                return this.setState(this.getDp('Active'), false, callback);
        }

        callback();
    }

    getFanActive(callback) {
        this.getState(this.getDp('Mode'), (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getFanActive(dp));
        });
    }

    _getFanActive(dp) {
        const {Characteristic} = this.hap;
        switch(dp) {
            case 'low':
                return 0;
            case 'high':
                return 1;
        }
    }

    setFanActive(value, callback) {
        const {Characteristic} = this.hap;

        if(value) {
          return this.setState(this.getDp('Mode'), 'high', callback);
        } else {
          return this.setState(this.getDp('Mode'), 'low', callback);
        }
        // callback();
    }

    getCurrentHumidity(callback) {
        this.getState(this.getDp('CurrentHumidity'), (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getCurrentHumidity(dp));
        });
    }

    _getCurrentHumidity(dp) {
        return dp;
    }

    getCurrentTemperature(callback) {
        this.getState(this.getDp('CurrentTemperature'), (err, dp) => {
            if (err) return callback(err);

            callback(null, this._getCurrentTemperature(dp));
        });
    }

    _getCurrentTemperature(dp) {
        return dp;
    }

    getTargetHumidity(callback) {
        this.getState([this.getDp('Active'), this.getDp('Humidity')], (err, dps) => {
            if (err) return callback(err);

            callback(null, this._getTargetHumidity(dps));
        });
    }

    _getTargetHumidity(dps) {
        if (!dps[this.getDp('Active')]) return 0;

        return dps[this.getDp('Humidity')];
    }

    setTargetHumidity(value, callback) {
        const {Characteristic} = this.hap;

        let origValue = value;
        value = Math.max(value, this.device.context.minHumidity || 35);
        value = Math.min(value, this.device.context.maxHumidity || 80);
        if (origValue != value) {
            this.characteristicHumidity.updateValue(value);
        }

        this.setMultiState({[this.getDp('Active')]: true, [this.getDp('Humidity')]: value}, callback);
    }

    getDp(name) {
        return this.device.context['dps' + name] ? this.device.context['dps' + name] : this.defaultDps[name];
    }
}

module.exports = Dehumidifier2Accessory;
