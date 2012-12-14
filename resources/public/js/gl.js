var gl = function() {
  var camera, scene, renderer;
  var geometry, material, mesh;
  var xtheta, ytheta, ztheta;

  var init = function() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 1000;
    scene.add( camera );

    geometry = new THREE.CubeGeometry( 200, 200, 200 );
    material = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe: true } );

    mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    var radius = 50, segments = 16, rings = 16;
    var sphereMaterial = new THREE.MeshLambertMaterial({
      color: 0xCC0000
    });

    var sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius,
                               segments,
                               rings),
      sphereMaterial);

    // add the sphere to the scene
    scene.add(sphere);

    // create a point light
    var pointLight = new THREE.PointLight( 0xFFFFFF );

    // set its position
    pointLight.position.x = 10;
    pointLight.position.y = 50;
    pointLight.position.z = 130;

    // add to the scene
    scene.add(pointLight);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );

    $('#gl').append( renderer.domElement );
  };

  var animate = function() {
    requestAnimationFrame( animate );
    render();
  };

  var render = function() {
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.02;

    renderer.render( scene, camera );
  };

  return {
    init: init,
    animate: animate,
    render: render,

    camera: camera, 
    scene: scene, 
    renderer: renderer,
    geometry: geometry, 
    material: material, 
    mesh: mesh
  };
}();
