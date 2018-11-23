/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'
/**
 * Write the unit tests for your transction processor functions here
 */

const AdminConnection = require('composer-admin').AdminConnection
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common')
const path = require('path')

const chai = require('chai')
chai.should()
chai.use(require('chai-as-promised'))

const namespace = 'org.catena'
const assetType = 'SupplyRequest'
const assetTypeUp = 'UpliftOrder'
const assetNS = namespace + '.' + assetType
const assetNSUp = namespace + '.' + assetTypeUp

const participantType = 'Distributor'
const participantNS = namespace + '.' + participantType

const participantTypeTrans = 'Transporter'
const participantNSTrans = namespace + '.' + participantTypeTrans

const participantTypeMan = 'Manufacturer'
const participantNSMan = namespace + '.' + participantTypeMan

const participantTypeCust = 'Customer'
const participantNSCust = namespace + '.' + participantTypeCust
const contractId = 'e30f2392-5fd5-4658-8bc1-017836e467b0'
describe('#' + namespace, () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore({
        type: 'composer-wallet-inmemory'
    })

    // Embedded connection used for local testing
    const connectionProfile = {
        name: 'embedded',
        'x-type': 'embedded'
    }

    // Name of the business network card containing the administrative identity for the business network
    const adminCardName = 'admin'

    // Admin connection to the blockchain, used to deploy the business network
    let adminConnection

    // This is the business network connection the tests will use.
    let businessNetworkConnection

    // This is the factory for creating instances of types.
    let factory

    // These are the identities for Alice and Bob.
    const africoilCardName = 'africoil'

    // These are a list of receieved events.
    let events

    let businessNetworkName

    /**
     *
     * @param {String} cardName The card name to use for this identity
     * @param {Object} identity The identity details
     */
    async function importCardForIdentity(cardName, identity) {
        const metadata = {
            userName: identity.userID,
            version: 1,
            enrollmentSecret: identity.userSecret,
            businessNetwork: businessNetworkName
        }
        const card = new IdCard(metadata, connectionProfile)
        await adminConnection.importCard(cardName, card)
    }

    before(async () => {
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' })

        // Identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: ['PeerAdmin', 'ChannelAdmin']
        }
        const deployerCard = new IdCard(deployerMetadata, connectionProfile)
        deployerCard.setCredentials(credentials)
        const deployerCardName = 'PeerAdmin'

        adminConnection = new AdminConnection({ cardStore: cardStore })

        await adminConnection.importCard(deployerCardName, deployerCard)
        await adminConnection.connect(deployerCardName)
    })

    // This is called before each test is executed.
    beforeEach(async () => {
        // Generate a business network definition from the project directory.
        let businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(
            path.resolve(__dirname, '..')
        )
        businessNetworkName = businessNetworkDefinition.getName()
        await adminConnection.install(businessNetworkDefinition)
        const startOptions = {
            networkAdmins: [
                {
                    userName: 'admin',
                    enrollmentSecret: 'adminpw'
                }
            ]
        }
        const adminCards = await adminConnection.start(
            businessNetworkName,
            businessNetworkDefinition.getVersion(),
            startOptions
        )
        await adminConnection.importCard(adminCardName, adminCards.get('admin'))

        // Create and establish a business network connection
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore })
        events = []
        businessNetworkConnection.on('event', event => {
            events.push(event)
        })
        await businessNetworkConnection.connect(adminCardName)

        // Get the factory for the business network.
        factory = businessNetworkConnection.getBusinessNetwork().getFactory()

        const participantRegistry = await businessNetworkConnection.getParticipantRegistry(
            participantNS
        )
        // Create the participants.
        const africoil = factory.newResource(namespace, participantType, 'D001')
        const cust = factory.newResource(namespace, participantTypeCust, 'C001')
        const manu = factory.newResource(namespace, participantTypeMan, 'M001')
        const trans = factory.newResource(namespace, participantTypeTrans, 'T001')
        africoil.name = 'test'
        cust.name = 'test'
        manu.name = 'test'
        trans.name = 'test'
        await participantRegistry.addAll([africoil, cust, manu, trans])

        // const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)
        // // Create the assets.
        // const asset1 = factory.newResource(namespace, assetType, '1')
        // asset1.owner = factory.newRelationship(namespace, participantType, 'alice@email.com')
        // asset1.value = '10'

        // const asset2 = factory.newResource(namespace, assetType, '2')
        // asset2.owner = factory.newRelationship(namespace, participantType, 'bob@email.com')
        // asset2.value = '20'

        // assetRegistry.addAll([asset1, asset2])

        // Issue the identities.
        let identity = await businessNetworkConnection.issueIdentity(
            participantNS + '#D001',
            'D001'
        )
        await importCardForIdentity(africoilCardName, identity)
    })

    /**
     * Reconnect using a different identity.
     * @param {String} cardName The name of the card for the identity to use
     */
    async function useIdentity(cardName) {
        await businessNetworkConnection.disconnect()
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore })
        events = []
        businessNetworkConnection.on('event', event => {
            events.push(event)
        })
        await businessNetworkConnection.connect(cardName)
        factory = businessNetworkConnection.getBusinessNetwork().getFactory()
    }
    /**
     * Funtion to be reused to create a supply chain request at the beginning of tests
     * @param {String} requestDate
     * @param {String} deliveryDate
     * @param {String} mabt
     */
    async function createSupplyRequest(
        requestDate = '2018-11-12',
        deliveryDate = '2018-11-20',
        mabt = '17:00'
    ) {
        const transaction = factory.newTransaction(namespace, 'createSupplyRequest')
        transaction.customer = factory.newRelationship(namespace, 'Customer', 'C001')
        transaction.distributor = factory.newRelationship(namespace, 'Distributor', 'D001')
        transaction.volume = 8000
        transaction.fuelType = 'Petrol'
        transaction.qualitySpecification = '14pm'

        transaction.deliveryDate = new Date(deliveryDate)
        transaction.requestDate = new Date(requestDate)
        transaction.deliveryLocation = 'Durban'
        transaction.supplyAgreement = factory.newRelationship(namespace, 'SupplyAgreement', '1')
        let tempMabt = deliveryDate + 'T' + mabt
        transaction.mabt = new Date(tempMabt)

        await businessNetworkConnection.submitTransaction(transaction)
    }
    /**
     * Function to create a supply agreement
     */
    async function createSupplyAgreement() {
        const transaction = factory.newTransaction(namespace, 'createSupplyAgreement')
        transaction.customer = factory.newRelationship(namespace, 'Customer', 'C001')
        transaction.distributor = factory.newRelationship(namespace, 'Distributor', 'D001')

        transaction.effectiveDate = new Date()
        transaction.expiryDate = new Date()
        transaction.priceSetDate = new Date()
        transaction.requestDatePrior = 2

        transaction.priceStructure = 'P=D+C'
        transaction.annualBaseQuantity = 8000000

        transaction.qualitySpecification = 'Uknown'
        transaction.supplyFailTime = 6

        transaction.penaltyPercentage = 10

        transaction.capPercentage = 10

        let trac = factory.newConcept(namespace, 'Site')
        trac.site = 'Belville'
        trac.division = 'Transnet Rail Freight'
        trac.zone = '01A'
        trac.siteType = 'RTL'

        let home = factory.newConcept(namespace, 'Site')

        home.site = 'Straddle Carriers'
        home.division = 'Transnet Port Terminals'
        home.zone = '01A'
        home.siteType = 'RTL'

        transaction.siteTable = [home, trac]

        let rebate = factory.newConcept(namespace, 'Rebate')
        rebate.rebate = 29
        rebate.siteType = 'Home Base'

        transaction.rebateTable = [rebate]

        let price = factory.newConcept(namespace, 'WholesaleListPrice')
        price.postedDate = new Date()
        price.fuelType = 'Petrol'
        price.zone = '01A'
        price.basicListPrice = 24
        price.zoneDifferential = 12
        price.wholesaleListPrice = 21
        transaction.wholesaleListPriceTable = [price]

        await businessNetworkConnection.submitTransaction(transaction)
        await addCiceroContract(contractId)
    }

    /**
     * Resusable function to add cicero contract Id
     */
    async function addCiceroContract(id) {
        var NS = 'org.catena'
        const transaction = factory.newTransaction(NS, 'addCiceroContract')

        transaction.supplyAgreement = factory.newRelationship('org.catena', 'SupplyAgreement', '1')
        transaction.ciceroContractId = id

        await businessNetworkConnection.submitTransaction(transaction)
    }
    /**
     * Function to be reused to create uplift order
     */
    async function createUpliftOrder() {
        await createSupplyRequest()
        const transaction = factory.newTransaction(namespace, 'createUpliftOrder')
        transaction.pickupTime = new Date()
        transaction.volume = 10000
        transaction.mabd = new Date()
        transaction.origin = 'Durban'
        transaction.destination = 'Cape Town'
        transaction.fuelType = 'Petrol'
        transaction.qualitySpecification = '14pm'
        transaction.transportCompany = 'Siya'

        transaction.supplyRequest = factory.newRelationship('org.catena', 'SupplyRequest', '1')
        transaction.distributor = factory.newRelationship('org.catena', 'Distributor', 'D001')
        transaction.manufacturer = factory.newRelationship('org.catena', 'Manufacturer', 'M001')
        transaction.transporter = factory.newRelationship('org.catena', 'Transporter', 'T001')
        await businessNetworkConnection.submitTransaction(transaction)
    }

    it('Can create a Supply Agreement', async () => {
        var NS = 'org.catena'
        await useIdentity(africoilCardName)

        await createSupplyAgreement()

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            'org.catena.SupplyAgreement'
        )
        let assets = await assetRegistry.getAll()

        let sa = assets[0]

        sa.annualBaseQuantity.should.equal(8000000)
        sa.distributor.getFullyQualifiedIdentifier().should.equal(NS + '.Distributor#D001')
        sa.customer.getFullyQualifiedIdentifier().should.equal(NS + '.Customer#C001')
        sa.siteTable.length.should.equal(2)
        sa.wholesaleListPriceTable.length.should.equal(1)
        sa.rebateTable.length.should.equal(1)
    })
    it('Can add contractId to Supply Agreement', async () => {
        var NS = 'org.catena'
        await useIdentity(africoilCardName)

        await createSupplyAgreement()
        await addCiceroContract('ABCD')

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            namespace + '.SupplyAgreement'
        )

        const assets = await assetRegistry.getAll()

        let sa = assets[0]
        sa.ciceroContractId.should.equal('ABCD')
    })
    it('Can create a supply chain request', async () => {
        var NS = 'org.catena'
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await addCiceroContract(contractId)
        await createSupplyRequest()

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.volume.should.equal(8000)
        scr.distributor.getFullyQualifiedIdentifier().should.equal(NS + '.Distributor#D001')
        scr.customer.getFullyQualifiedIdentifier().should.equal(NS + '.Customer#C001')
    })
    it('Reject supply request on requestDatePrior', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await addCiceroContract(contractId)
        const transaction = factory.newTransaction(namespace, 'createSupplyRequest')
        transaction.customer = factory.newRelationship(namespace, 'Customer', 'C001')
        transaction.distributor = factory.newRelationship(namespace, 'Distributor', 'D001')
        transaction.volume = 8000
        transaction.fuelType = 'Petrol'
        transaction.qualitySpecification = '14pm'

        transaction.deliveryDate = new Date('2018-11-6')
        transaction.requestDate = new Date('2018-11-5')
        transaction.deliveryLocation = 'Durban'
        transaction.supplyAgreement = factory.newRelationship(namespace, 'SupplyAgreement', '1')
        transaction.mabt = new Date()

        await businessNetworkConnection
            .submitTransaction(transaction)
            .then(data => {
                data.should.be.an.instanceOf(Error)
            })
            .catch(err => {
                err.should.exist
                err.should.be.an.instanceOf(Error)
                err.message.should.equal(
                    'Delivery Date does not fall within the request date prior range'
                )
            })
    })
    it('Get cost on delivery request', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest('2018-11-12', '2018-11-23')

        const transaction = factory.newTransaction('org.catena', 'deliveryCompleted')
        transaction.deliveryLocation = '01A'
        transaction.fuelType = 'Diesel 0.05%'
        transaction.qualitySpecification = 'SANS 342:2006'
        transaction.volume = 80000
        transaction.sr = factory.newRelationship('org.catena', 'SupplyRequest', '1')

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            namespace + '.SupplyRequest'
        )

        const asset = await assetRegistry.get('1')

        asset.requestState.should.equal('COMPLETED')
    })
    it('Fails supply on delivery time', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest('2018-11-12', '2018-11-22', '10:00')

        const transaction = factory.newTransaction('org.catena', 'deliveryCompleted')
        transaction.deliveryLocation = '01A'
        transaction.fuelType = 'Diesel 0.05%'
        transaction.qualitySpecification = 'SANS 342:2016'
        transaction.volume = 80000
        transaction.sr = factory.newRelationship('org.catena', 'SupplyRequest', '1')

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            namespace + '.SupplyRequest'
        )

        const asset = await assetRegistry.get('1')

        asset.requestState.should.equal('FAILED')
    })
    it('Fails supply on specification failure', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest('2018-11-12', '2018-11-23')

        const transaction = factory.newTransaction('org.catena', 'deliveryCompleted')
        transaction.deliveryLocation = '01A'
        transaction.fuelType = 'Diesel 0.05%'
        transaction.qualitySpecification = 'SANS 342:2016'
        transaction.volume = 80000
        transaction.sr = factory.newRelationship('org.catena', 'SupplyRequest', '1')

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            namespace + '.SupplyRequest'
        )

        const asset = await assetRegistry.get('1')

        asset.requestState.should.equal('FAILED')
    })
    it('Supply is late', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest('2018-11-12', '2018-11-23', '08:00')

        const transaction = factory.newTransaction('org.catena', 'deliveryCompleted')
        transaction.deliveryLocation = '01A'
        transaction.fuelType = 'Diesel 0.05%'
        transaction.qualitySpecification = 'SANS 342:2006'
        transaction.volume = 80000
        transaction.sr = factory.newRelationship('org.catena', 'SupplyRequest', '1')

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            namespace + '.SupplyRequest'
        )

        const asset = await assetRegistry.get('1')

        asset.requestState.should.equal('LATE')
    })
    it('Can add supply agreement Documnet', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        const transaction = factory.newTransaction('org.catena', 'addSupplyAgreementDocument')
        transaction.supplyAgreement = factory.newRelationship('org.catena', 'SupplyAgreement', '1')

        transaction.supplyAgreementDocumentHash = 'ABC'
        transaction.supplyAgreementDocumentUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            namespace + '.SupplyAgreement'
        )

        const assets = await assetRegistry.getAll()

        let sa = assets[0]

        sa.supplyAgreementDocumentHash.should.equal('ABC')
        sa.supplyAgreementDocumentUrl.should.equal('Thisisaurl')
    })
    it('Can add a location history', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()

        await createSupplyRequest()

        const transaction = factory.newTransaction(namespace, 'addLocationHistory')

        transaction.sr = factory.newRelationship(namespace, 'SupplyRequest', '1')

        transaction.longitude = 34.22
        transaction.latitude = 32.22

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            'org.catena.SupplyRequest'
        )

        let assets = await assetRegistry.getAll()

        let sr = assets[0]

        sr.locationHistory.length.should.equal(1)
    })
    it('Can add supply chain request to supply agreement', async () => {
        await useIdentity(africoilCardName)

        await createSupplyAgreement()
        await createSupplyRequest()
        const transaction = factory.newTransaction('org.catena', 'addSupplyRequest')
        transaction.supplyAgreement = factory.newRelationship('org.catena', 'SupplyAgreement', '1')
        transaction.supplyRequest = factory.newRelationship('org.catena', 'SupplyRequest', '1')
        await businessNetworkConnection.submitTransaction(transaction)
        const assetRegistry = await businessNetworkConnection.getAssetRegistry(
            namespace + '.SupplyAgreement'
        )

        const assets = await assetRegistry.getAll()

        let sa = assets[0]
        sa.supplyRequests.length.should.equal(1)
    })
    it('Can confirm supply', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest()

        const transaction = factory.newTransaction(namespace, 'confirmSupply')
        transaction.sr = factory.newRelationship(namespace, 'SupplyRequest', '1')

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.supplyConfirmed.should.equal(true)
    })

    it('Can add supply request  docs', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest()

        const transaction = factory.newTransaction(namespace, 'addSupplyRequestRecord')
        transaction.sr = factory.newRelationship(namespace, 'SupplyRequest', '1')

        transaction.supplyRequestRecordHash = 'ABC'
        transaction.supplyRequestRecordUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.supplyRequestRecordUrl.should.equal('Thisisaurl')
        scr.supplyRequestRecordHash.should.equal('ABC')
    })

    it('Can add purchase order docs', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest()

        const transaction = factory.newTransaction(namespace, 'addPurchaseOrder')
        transaction.sr = factory.newRelationship(namespace, 'SupplyRequest', '1')

        transaction.purchaseOrderHash = 'ABC'
        transaction.purchaseOrderUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.purchaseOrderUrl.should.equal('Thisisaurl')
        scr.purchaseOrderHash.should.equal('ABC')
    })

    it('Can add Distibutor invoice docs', async () => {
        await useIdentity(africoilCardName)
        await createSupplyAgreement()
        await createSupplyRequest()

        const transaction = factory.newTransaction(namespace, 'addDistributorInvoice')
        transaction.sr = factory.newRelationship(namespace, 'SupplyRequest', '1')

        transaction.distributorInvoiceHash = 'ABC'
        transaction.distributorInvoiceUrl = 'Thisisaurl'

        await businessNetworkConnection.submitTransaction(transaction)

        const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNS)

        let assets = await assetRegistry.getAll()

        let scr = assets[0]

        scr.distributorInvoiceUrl.should.equal('Thisisaurl')
        scr.distributorInvoiceHash.should.equal('ABC')
    })
    //TODO: Uncomment when uplift order is intergrated
    // it('Can Create an uplift order', async () => {
    //     var NS = 'org.catena'

    //     await useIdentity(africoilCardName)

    //     await createUpliftOrder()

    //     const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

    //     let assets = await assetRegistry.getAll()

    //     let uplift = assets[0]

    //     uplift.volume.should.equal(10000)
    //     uplift.supplyRequest.getFullyQualifiedIdentifier().should.equal(NS + '.SupplyRequest#1')
    //     uplift.distributor.getFullyQualifiedIdentifier().should.equal(NS + '.Distributor#D001')
    //     uplift.manufacturer.getFullyQualifiedIdentifier().should.equal(NS + '.Manufacturer#M001')
    //     uplift.transporter.getFullyQualifiedIdentifier().should.equal(NS + '.Transporter#T001')
    //     uplift.origin.should.equal('Durban')
    //     uplift.destination.should.equal('Cape Town')
    //     uplift.fuelType.should.equal('Petrol')
    // })

    // it('Can add collection order document', async () => {
    //     await useIdentity(africoilCardName)

    //     await createUpliftOrder()

    //     const transaction = factory.newTransaction(namespace, 'addCollectionOrderDocument')

    //     transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

    //     transaction.collectionOrderDocumentHash = 'ABC'
    //     transaction.collectionOrderDocumentUrl = 'Thisisaurl'

    //     await businessNetworkConnection.submitTransaction(transaction)

    //     const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

    //     let assets = await assetRegistry.getAll()

    //     let up = assets[0]

    //     up.collectionOrderDocumentHash.should.equal('ABC')
    //     up.collectionOrderDocumentUrl.should.equal('Thisisaurl')
    // })

    // it('add collection Receipt Document', async () => {
    //     await useIdentity(africoilCardName)

    //     await createUpliftOrder()

    //     const transaction = factory.newTransaction(namespace, 'addCollectionReceiptDocument')

    //     transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

    //     transaction.collectionReceiptDocumentHash = 'ABC'
    //     transaction.collectionReceiptDocumentUrl = 'Thisisaurl'

    //     await businessNetworkConnection.submitTransaction(transaction)

    //     const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

    //     let assets = await assetRegistry.getAll()

    //     let up = assets[0]

    //     up.collectionReceiptDocumentHash.should.equal('ABC')
    //     up.collectionReceiptDocumentUrl.should.equal('Thisisaurl')
    // })

    // it('add manufacturerInvoice', async () => {
    //     await useIdentity(africoilCardName)

    //     await createUpliftOrder()

    //     const transaction = factory.newTransaction(namespace, 'addManufacturerInvoice')

    //     transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

    //     transaction.manufacturerInvoiceHash = 'ABC'
    //     transaction.manufacturerInvoiceUrl = 'Thisisaurl'

    //     await businessNetworkConnection.submitTransaction(transaction)

    //     const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

    //     let assets = await assetRegistry.getAll()

    //     let up = assets[0]

    //     up.manufacturerInvoiceHash.should.equal('ABC')
    //     up.manufacturerInvoiceUrl.should.equal('Thisisaurl')
    // })

    // it('add transportation Invoice', async () => {
    //     await useIdentity(africoilCardName)

    //     await createUpliftOrder()

    //     const transaction = factory.newTransaction(namespace, 'addTransportationInvoice')

    //     transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

    //     transaction.transportationInvoiceHash = 'ABC'
    //     transaction.transportationInvoiceUrl = 'Thisisaurl'

    //     await businessNetworkConnection.submitTransaction(transaction)

    //     const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

    //     let assets = await assetRegistry.getAll()

    //     let up = assets[0]

    //     up.transportationInvoiceHash.should.equal('ABC')
    //     up.transportationInvoiceUrl.should.equal('Thisisaurl')
    // })

    // it('Can confirm collection date', async () => {
    //     await useIdentity(africoilCardName)

    //     await createUpliftOrder()

    //     const transaction = factory.newTransaction(namespace, 'confirmCollectionDate')
    //     transaction.upliftOrder = factory.newRelationship(namespace, 'UpliftOrder', '1')

    //     await businessNetworkConnection.submitTransaction(transaction)

    //     const assetRegistry = await businessNetworkConnection.getAssetRegistry(assetNSUp)

    //     let assets = await assetRegistry.getAll()

    //     let up = assets[0]

    //     up.collectionDateConfirmed = true
    // })
})
